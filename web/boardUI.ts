import type { Move, PlayerId, Hand, GameState } from "../src/index.js";

const HANDS: Hand[] = ["left", "right"];

type DragState = {
  sourcePlayer: PlayerId;
  sourceHand: Hand;
  pointerId: number;
  ghost: HTMLElement;
};

export interface BoardUIOptions {
  readonly state: GameState;
  readonly turn: PlayerId;
  readonly finished: boolean;
  readonly interactive: boolean;
  /** Which player is rendered closest to the viewer. Defaults to A for local play. */
  readonly bottomPlayer?: PlayerId;
  readonly onMove: (move: Move) => void;
  readonly onInteractionStatus?: (message: string) => void;
}

export function renderBoard(options: BoardUIOptions): void {
  const bottomPlayer = options.bottomPlayer ?? "A";
  const topPlayer = bottomPlayer === "A" ? "B" : "A";
  renderRow("opponent", topPlayer, options.state.players[topPlayer], options.turn === topPlayer, options);
  renderRow("player", bottomPlayer, options.state.players[bottomPlayer], options.turn === bottomPlayer, options);
}

function renderRow(
  rowId: string,
  player: PlayerId,
  hands: { left: number; right: number },
  active: boolean,
  options: BoardUIOptions,
): void {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = "";
  row.classList.toggle("active", active);
  row.setAttribute("data-player", player);

  for (const hand of HANDS) {
    const value = hands[hand];
    const dead = value === 0;
    const draggable = options.interactive && !options.finished && player === options.turn && !dead;
    const el = createHandElement(player, hand, value, dead, draggable, options);
    row.appendChild(el);
  }
}

let currentOptions: BoardUIOptions | null = null;
let drag: DragState | null = null;

export function bindBoard(options: BoardUIOptions): void {
  currentOptions = options;
  if (
    selectedSource &&
    (!options.interactive || options.finished || selectedSource.player !== options.turn || options.state.players[selectedSource.player][selectedSource.hand] === 0)
  ) {
    selectedSource = null;
  }
  renderBoard(options);
}

type SelectedSource = { player: PlayerId; hand: Hand };
let selectedSource: SelectedSource | null = null;

function createHandElement(
  player: PlayerId,
  hand: Hand,
  value: number,
  dead: boolean,
  draggable: boolean,
  options: BoardUIOptions,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hand" + (dead ? " dead" : "") + (draggable ? " draggable" : "");
  el.dataset.player = player;
  el.dataset.hand = hand;
  const selectableTarget = options.interactive && !options.finished && !dead;
  el.disabled = !selectableTarget;
  el.setAttribute("aria-label", `${player} ${hand} hand: ${value}`);
  if (selectedSource?.player === player && selectedSource.hand === hand) {
    el.classList.add("selected");
    el.setAttribute("aria-pressed", "true");
  }

  const inner = document.createElement("div");
  inner.className = "hand-inner";
  inner.textContent = String(value);
  el.appendChild(inner);

  const label = document.createElement("span");
  label.className = "hand-label";
  label.textContent = `${player} ${hand[0]!.toUpperCase()}`;
  el.appendChild(label);

  if (draggable) {
    el.addEventListener("pointerdown", onPointerDown);
  }
  if (selectableTarget) el.addEventListener("click", onHandClick);

  return el;
}

function onHandClick(event: MouseEvent): void {
  const handEl = event.currentTarget as HTMLElement;
  const player = handEl.dataset.player as PlayerId;
  const hand = handEl.dataset.hand as Hand;
  if (!player || !hand || !currentOptions) return;

  if (!selectedSource) {
    if (player !== currentOptions.turn) {
      currentOptions.onInteractionStatus?.("Select one of your living hands first.");
      return;
    }
    selectedSource = { player, hand };
    currentOptions.onInteractionStatus?.(`Selected ${player} ${hand}. Choose a living hand to tap.`);
    renderBoard(currentOptions);
    return;
  }

  if (selectedSource.player === player && selectedSource.hand === hand) {
    selectedSource = null;
    currentOptions.onInteractionStatus?.("Selection cancelled.");
    renderBoard(currentOptions);
    return;
  }

  const move: Move = {
    type: "tap",
    player: selectedSource.player,
    source: selectedSource.hand,
    targetPlayer: player,
    target: hand,
  };
  selectedSource = null;
  currentOptions.onMove(move);
}

function onPointerDown(e: PointerEvent): void {
  const target = e.target as HTMLElement;
  const handEl = target.closest(".hand") as HTMLElement | null;
  if (!handEl) return;

  const player = handEl.dataset.player as PlayerId;
  const hand = handEl.dataset.hand as Hand;
  if (!player || !hand) return;

  e.preventDefault();
  handEl.setPointerCapture(e.pointerId);

  const ghost = handEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("drag-ghost");
  ghost.style.position = "fixed";
  ghost.style.left = `${e.clientX - handEl.offsetWidth / 2}px`;
  ghost.style.top = `${e.clientY - handEl.offsetHeight / 2}px`;
  ghost.style.width = `${handEl.offsetWidth}px`;
  ghost.style.height = `${handEl.offsetHeight}px`;
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "1000";
  document.body.appendChild(ghost);
  handEl.classList.add("dragging");

  drag = { sourcePlayer: player, sourceHand: hand, pointerId: e.pointerId, ghost };
  updateDropTargets();

  handEl.addEventListener("pointermove", onPointerMove);
  handEl.addEventListener("pointerup", onPointerUp);
  handEl.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return;
  if (e.pointerId !== drag.pointerId) return;
  drag.ghost.style.left = `${e.clientX - drag.ghost.offsetWidth / 2}px`;
  drag.ghost.style.top = `${e.clientY - drag.ghost.offsetHeight / 2}px`;
  highlightTargetAt(e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  if (!drag) return;
  if (e.pointerId !== drag.pointerId) return;

  const target = handElementAt(e.clientX, e.clientY);
  if (target) {
    const targetPlayer = target.dataset.player as PlayerId;
    const targetHand = target.dataset.hand as Hand;
    if (targetPlayer && targetHand) {
      const move: Move = {
        type: "tap",
        player: drag.sourcePlayer,
        source: drag.sourceHand,
        targetPlayer,
        target: targetHand,
      };
      selectedSource = null;
      currentOptions?.onMove(move);
    }
  }

  cleanupDrag();
}

function cleanupDrag(): void {
  if (!drag) return;
  drag.ghost.remove();
  document.querySelectorAll(".hand.dragging").forEach((el) => el.classList.remove("dragging"));
  document.querySelectorAll(".hand.drop-target").forEach((el) => el.classList.remove("drop-target"));
  document.querySelectorAll(".hand.drop-target-hover").forEach((el) => el.classList.remove("drop-target-hover"));
  drag = null;
}

function updateDropTargets(): void {
  if (!drag) return;
  document.querySelectorAll(".hand").forEach((el) => {
    const handEl = el as HTMLElement;
    const player = handEl.dataset.player as PlayerId;
    const hand = handEl.dataset.hand as Hand;
    if (!player || !hand) return;
    const dead = handEl.classList.contains("dead");
    const isSelf = player === drag!.sourcePlayer && hand === drag!.sourceHand;
    if (!dead && !isSelf) {
      handEl.classList.add("drop-target");
    }
  });
}

function highlightTargetAt(x: number, y: number): void {
  document.querySelectorAll(".hand.drop-target-hover").forEach((el) => el.classList.remove("drop-target-hover"));
  const target = handElementAt(x, y);
  if (target) target.classList.add("drop-target-hover");
}

function handElementAt(x: number, y: number): HTMLElement | null {
  drag?.ghost.style.setProperty("display", "none");
  const elements = document.elementsFromPoint(x, y);
  drag?.ghost.style.setProperty("display", "");
  for (const el of elements) {
    const handEl = el.closest(".hand") as HTMLElement | null;
    if (handEl && handEl.classList.contains("drop-target")) return handEl;
  }
  return null;
}
