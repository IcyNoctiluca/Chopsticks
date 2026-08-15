import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";

// Same SVG geometry as web/handSVG.ts. The path numbers are the portable asset;
// this component renders them via react-native-svg for iOS.
const FINGER_WIDTH = 6;
const FINGER_GAP = 3;
const FINGER_HEIGHT = 34;
const PALM_HEIGHT = 18;
const PALM_WIDTH = FINGER_WIDTH * 4 + FINGER_GAP * 3 + 8;
const SVG_WIDTH = PALM_WIDTH + 4;
const SVG_HEIGHT = FINGER_HEIGHT + PALM_HEIGHT + 4;

export interface HandSVGProps {
  value: number;
  side: "left" | "right";
  dead?: boolean;
}

export function HandSVG({ value, side, dead = false }: HandSVGProps): React.ReactElement {
  const raised = Math.max(0, Math.min(4, value));
  const fill = dead ? "#5a5f70" : "#e8eaf0";
  const stroke = dead ? "#3a3f4a" : "#9aa3b2";

  const palmX = 2;
  const palmY = FINGER_HEIGHT + 2;

  const fingers: React.ReactElement[] = [];
  for (let i = 0; i < 4; i++) {
    const fx = palmX + 4 + i * (FINGER_WIDTH + FINGER_GAP);
    const fy = 2;
    const isUp = i < raised;
    const h = isUp ? FINGER_HEIGHT : 8;
    const y = isUp ? fy : fy + (FINGER_HEIGHT - 8);
    const fFill = isUp ? fill : "#3a3f4a";
    const fStroke = isUp ? stroke : "#2c3349";
    fingers.push(
      <Rect key={i} x={fx} y={y} width={FINGER_WIDTH} height={h} rx={3} fill={fFill} stroke={fStroke} strokeWidth={1} />,
    );
  }

  const thumbX = side === "left" ? palmX - 2 : palmX + PALM_WIDTH - FINGER_WIDTH + 2;

  return (
    <View style={[styles.art, dead && styles.dead]}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
        <Rect x={thumbX} y={palmY - 2} width={FINGER_WIDTH} height={12} rx={3} fill={fill} stroke={stroke} strokeWidth={1} />
        <Rect x={palmX} y={palmY} width={PALM_WIDTH} height={PALM_HEIGHT} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />
        {fingers}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: SVG_HEIGHT + 4,
  },
  dead: {
    opacity: 0.4,
  },
});