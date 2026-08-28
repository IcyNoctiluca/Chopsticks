import { getRedistributionMoves, describeRedistribution } from "./redistribute.js";
import type { GameState, Move } from "../src/index.js";

export interface SplitPickerOptions {
  readonly state: GameState;
  readonly interactive: boolean;
  readonly onMove: (move: Move) => void;
}

export function renderSplitPicker(container: HTMLElement, options: SplitPickerOptions): void {
  const moves = options.interactive ? getRedistributionMoves(options.state) : [];
  container.hidden = moves.length === 0;
  container.innerHTML = "";
  if (moves.length === 0) return;

  const label = document.createElement("span");
  label.className = "split-label";
  label.textContent = "Split to revive:";
  container.appendChild(label);

  for (const move of moves) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "split-option";
    btn.textContent = describeRedistribution(move);
    btn.addEventListener("click", () => options.onMove(move));
    container.appendChild(btn);
  }
}
