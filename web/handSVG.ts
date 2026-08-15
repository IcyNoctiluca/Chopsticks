// Reusable hand SVG asset. The SVG paths are the portable asset — they render
// identically in web (inline SVG) and React Native (react-native-svg).
// Finger count shown = hand value (0 = dead/fist, 1-4 = that many fingers raised).

export interface HandSVGOptions {
  readonly value: number;
  readonly side: "left" | "right";
  readonly dead?: boolean;
}

// Each finger: an upright rounded bar from the palm.
// Palm is a rounded base. Layout is simplistic but readable.
const FINGER_WIDTH = 6;
const FINGER_GAP = 3;
const FINGER_HEIGHT = 34;
const PALM_HEIGHT = 18;
const PALM_WIDTH = FINGER_WIDTH * 4 + FINGER_GAP * 3 + 8;
const SVG_WIDTH = PALM_WIDTH + 4;
const SVG_HEIGHT = FINGER_HEIGHT + PALM_HEIGHT + 4;

export function handSVG({ value, side, dead = false }: HandSVGOptions): string {
  const raised = Math.max(0, Math.min(4, value));
  const fill = dead ? "#5a5f70" : "#e8eaf0";
  const stroke = dead ? "#3a3f4a" : "#9aa3b2";
  const opacity = dead ? 0.4 : 1;

  // Palm
  const palmX = 2;
  const palmY = FINGER_HEIGHT + 2;
  const palm = `<rect x="${palmX}" y="${palmY}" width="${PALM_WIDTH}" height="${PALM_HEIGHT}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;

  // Fingers (4 slots; value of 0 shows a closed fist — all fingers down/dark)
  const fingers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const fx = palmX + 4 + i * (FINGER_WIDTH + FINGER_GAP);
    const fy = 2;
    const isUp = i < raised;
    const h = isUp ? FINGER_HEIGHT : 8;
    const y = isUp ? fy : fy + (FINGER_HEIGHT - 8);
    const fFill = isUp ? fill : "#3a3f4a";
    const fStroke = isUp ? stroke : "#2c3349";
    fingers.push(`<rect x="${fx}" y="${y}" width="${FINGER_WIDTH}" height="${h}" rx="3" fill="${fFill}" stroke="${fStroke}" stroke-width="1" />`);
  }

  // Thumb (simplified nub on the side)
  const thumbX = side === "left" ? palmX - 2 : palmX + PALM_WIDTH - FINGER_WIDTH + 2;
  const thumbY = palmY - 2;
  const thumb = `<rect x="${thumbX}" y="${thumbY}" width="${FINGER_WIDTH}" height="12" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1" />`;

  return `<svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" style="opacity:${opacity}" aria-hidden="true">
  ${thumb}
  ${palm}
  ${fingers.join("\n  ")}
</svg>`;
}

export function handSVGDimensions(): { width: number; height: number } {
  return { width: SVG_WIDTH, height: SVG_HEIGHT };
}