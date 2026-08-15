import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, AccessibilityInfo } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createSession,
  getState,
  playHumanMove,
  advanceAITurns,
  undoInSession,
  canUndoInSession,
  startNextGame,
  type MatchSession,
  type MatchConfig,
} from "../session/session";
import { getLegalMoves, getWinner, type Move, type GameState } from "../src/index";
import { HandSVG } from "./HandSVG";

const HANDS = ["left", "right"] as const;

const baseConfig: MatchConfig = {
  playerA: { name: "Player A", type: "human" },
  playerB: { name: "Player B", type: "human" },
  undoPolicy: "unlimited",
  moveTimerMs: null,
  gamesToWin: 3,
};

export function GameScreen(): React.ReactElement {
  const [session, setSession] = useState<MatchSession>(() => createSession(baseConfig));
  const state = getState(session);
  const winner = getWinner(state);
  const active = state.turn;
  const legalMoves = winner ? [] : getLegalMoves(state);

  const onMove = useCallback((idx: number) => {
    setSession((prev) => {
      const s = prev;
      const st = getState(s);
      if (st.status === "finished") return s;
      const moves = getLegalMoves(st);
      const move = moves[idx];
      if (!move) return s;
      const after = playHumanMove(s, move);
      return advanceAITurns(after);
    });
  }, []);

  const onUndo = useCallback(() => {
    setSession((prev) => {
      if (!canUndoInSession(prev)) return prev;
      try {
        return undoInSession(prev, 1);
      } catch {
        return prev;
      }
    });
  }, []);

  const onRestart = useCallback(() => {
    setSession((prev) => {
      const next = { ...prev, currentRecord: startNextGame(prev).currentRecord, undoCount: 0 };
      return advanceAITurns(next);
    });
  }, []);

  const onNewMatch = useCallback(() => {
    setSession(createSession(baseConfig));
  }, []);

  const statusText = winner
    ? `🏆 Player ${winner} wins! Score: A ${session.scores.A} – B ${session.scores.B}`
    : `Player ${active}'s turn — Score: A ${session.scores.A} – B ${session.scores.B}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Chopsticks</Text>
        <Text
          style={styles.status}
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
        >
          {statusText}
        </Text>

        <View style={styles.board}>
          <PlayerHands player={state.players.B} label="B" active={active === "B"} />
          <View style={styles.divider} />
          <PlayerHands player={state.players.A} label="A" active={active === "A"} />
        </View>

        <View style={styles.moves}>
          {winner ? (
            <Text style={styles.muted}>Game over. Tap “New game” to play another.</Text>
          ) : (
            legalMoves.map((m, i) => (
              <Pressable
                key={i}
                style={styles.moveBtn}
                onPress={() => onMove(i)}
                accessibilityLabel={describeMove(m)}
                accessibilityRole="button"
              >
                <Text style={styles.moveText}>{describeMove(m)}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.controls}>
          <Pressable style={[styles.ctrl, !canUndoInSession(session) && styles.disabled]} onPress={onUndo} accessibilityRole="button">
            <Text style={styles.ctrlText}>Undo</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={onRestart} accessibilityRole="button">
            <Text style={styles.ctrlText}>New game</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={onNewMatch} accessibilityRole="button">
            <Text style={styles.ctrlText}>New match</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerHands({
  player,
  label,
  active,
}: {
  player: GameState["players"]["A"];
  label: string;
  active: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.playerRow, active && styles.playerActive]}>
      {HANDS.map((hand) => {
        const value = hand === "left" ? player.left : player.right;
        const isDead = value === 0;
        return (
          <View key={hand} style={[styles.hand, isDead && styles.handDead]} accessibilityLabel={`${label} ${hand} ${value}`}>
            <Text style={styles.handLabel}>{`${label} ${hand[0]!.toUpperCase()}`}</Text>
            <HandSVG value={value} side={hand} dead={isDead} />
            <Text style={styles.handValue}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

function describeMove(move: Move): string {
  if (move.type === "tap") {
    const sh = move.source === "left" ? "L" : "R";
    const th = move.target === "left" ? "L" : "R";
    const whose = move.targetPlayer === move.player ? "your" : "opponent's";
    return `Tap ${sh} → ${whose} ${th}`;
  }
  return `Split to R:${move.right} L:${move.left}`;
}

void AccessibilityInfo;

const COL = {
  bg: "#0f1220",
  panel: "#1b2030",
  panel2: "#242b40",
  text: "#e8eaf0",
  muted: "#9aa3b2",
  accent: "#8fd0ff",
  border: "#2c3349",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COL.bg },
  scroll: { flex: 1 },
  content: { padding: 16, alignItems: "stretch", gap: 12 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", color: COL.text },
  status: { textAlign: "center", color: COL.muted, fontSize: 15 },
  board: { backgroundColor: COL.panel, borderColor: COL.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  divider: { height: 1, backgroundColor: COL.border },
  playerRow: { flexDirection: "row", justifyContent: "space-around", gap: 10 },
  playerActive: {},
  hand: { backgroundColor: COL.panel2, borderColor: COL.border, borderWidth: 2, borderRadius: 16, padding: 12, alignItems: "center", minWidth: 120 },
  handDead: { opacity: 0.45 },
  handLabel: { fontSize: 11, color: COL.muted, letterSpacing: 1, marginBottom: 6 },
  handValue: { fontSize: 22, fontWeight: "700", color: COL.text, marginTop: 4 },
  moves: { gap: 6 },
  muted: { color: COL.muted, textAlign: "center", padding: 10 },
  moveBtn: { backgroundColor: COL.panel, borderColor: COL.border, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  moveText: { color: COL.text, fontSize: 15 },
  controls: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  ctrl: { backgroundColor: COL.panel, borderColor: COL.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ctrlText: { color: COL.text, fontSize: 14 },
  disabled: { opacity: 0.5 },
});