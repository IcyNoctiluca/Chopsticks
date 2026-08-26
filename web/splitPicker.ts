import type { RedistributeMove } from "../src/index.js";
import { redistributionLabel } from "./moves.js";

/** Renders the exact engine-derived redistribution choices without recreating rule logic in a client. */
export function renderRedistributionChoices(
  container: HTMLElement,
  moves: readonly RedistributeMove[],
  onChoose: (move: RedistributeMove) => void,
): void {
  container.replaceChildren();
  for (const move of moves) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = redistributionLabel(move);
    button.setAttribute("aria-label", `Redistribute to left ${move.left}, right ${move.right}`);
    button.addEventListener("click", () => onChoose(move));
    container.appendChild(button);
  }
}
