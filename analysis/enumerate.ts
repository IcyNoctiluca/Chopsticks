import {
  createGame,
  getLegalMoves,
  applyMove,
  getWinner,
  type GameState,
  type Move,
} from "../src/index.js";

type PlayerId = "A" | "B";
type GameValue = "WIN" | "LOSS" | "DRAW";

function stateKey(state: GameState): string {
  const a = state.players.A;
  const b = state.players.B;
  return `${a.right},${a.left}|${b.right},${b.left}|${state.turn}|${state.status}`;
}

function perspectiveKey(state: GameState): string {
  // Normalise so the value is from the perspective of the player to move.
  // We store canonical state by always listing the player-to-move first.
  // For comparison we keep turn info so A/B identity is preserved for opening adv.
  return stateKey(state);
}

function describeState(state: GameState): string {
  const a = state.players.A;
  const b = state.players.B;
  let s = `A:[${a.right},${a.left}] B:[${b.right},${b.left}] turn:${state.turn}`;
  if (state.winner) s += ` winner:${state.winner}`;
  return s;
}

interface Node {
  state: GameState;
  key: string;
  successors: string[]; // keys of states reachable by one legal move
  moveCount: number;
}

function analyse(): void {
  const start = createGame();
  const nodes = new Map<string, Node>();
  const queue: GameState[] = [start];

  // BFS to enumerate all reachable states
  while (queue.length > 0) {
    const state = queue.pop()!;
    const key = stateKey(state);
    if (nodes.has(key)) continue;

    const legal = getLegalMoves(state);
    const successorStates: GameState[] = [];
    for (const move of legal) {
      successorStates.push(applyMove(state, move));
    }

    nodes.set(key, {
      state,
      key,
      successors: successorStates.map((s2) => stateKey(s2)),
      moveCount: legal.length,
    });

    for (const s2 of successorStates) {
      const k2 = stateKey(s2);
      if (!nodes.has(k2)) queue.push(s2);
    }
  }

  const allKeys = Array.from(nodes.keys());
  const totalStates = allKeys.length;
  const terminalStates = allKeys.filter((k) => nodes.get(k)!.state.status === "finished");
  const playingStates = totalStates - terminalStates.length;

  // Retrograde analysis (backward induction with cycle/draw handling)
  // Value is from the perspective of the player to move.
  const value = new Map<string, GameValue>();
  // For terminal states, player to move loses (winner is the other)
  for (const k of terminalStates) value.set(k, "LOSS");

  // Build reverse adjacency: for each state, which states can reach it
  const predecessors = new Map<string, Set<string>>();
  for (const node of nodes.values()) {
    if (!predecessors.has(node.key)) predecessors.set(node.key, new Set());
    for (const succ of node.successors) {
      if (!predecessors.has(succ)) predecessors.set(succ, new Set());
      predecessors.get(succ)!.add(node.key);
    }
  }

  // Track count of WIN successors for each non-terminal state
  const winSuccessorCount = new Map<string, number>();
  const totalSuccessorCount = new Map<string, number>();
  for (const node of nodes.values()) {
    if (value.get(node.key) === undefined) {
      totalSuccessorCount.set(node.key, node.successors.length);
      winSuccessorCount.set(node.key, 0);
    }
  }

  // Worklist of LOSS states whose predecessors might become WIN
  const worklist: string[] = [...terminalStates];

  while (worklist.length > 0) {
    const lossKey = worklist.pop()!;
    const preds = predecessors.get(lossKey) || new Set();
    for (const predKey of preds) {
      if (value.get(predKey) !== undefined) continue;
      // If a successor is LOSS, this predecessor is WIN
      value.set(predKey, "WIN");
      // Now update predecessors of this WIN state: they gain a WIN successor
      const grandPreds = predecessors.get(predKey) || new Set();
      for (const gpKey of grandPreds) {
        if (value.get(gpKey) !== undefined) continue;
        winSuccessorCount.set(gpKey, (winSuccessorCount.get(gpKey) ?? 0) + 1);
        const total = totalSuccessorCount.get(gpKey) ?? 0;
        if ((winSuccessorCount.get(gpKey) ?? 0) === total) {
          value.set(gpKey, "LOSS");
          worklist.push(gpKey);
        }
      }
    }
  }

  // Remaining undefined → DRAW
  for (const k of allKeys) {
    if (value.get(k) === undefined) value.set(k, "DRAW");
  }

  const startKey = stateKey(start);
  const startValue = value.get(startKey)!;
  const startWinner: PlayerId | null = getWinner(start);

  // Stats
  const winCount = allKeys.filter((k) => value.get(k) === "WIN").length;
  const lossCount = allKeys.filter((k) => value.get(k) === "LOSS").length;
  const drawCount = allKeys.filter((k) => value.get(k) === "DRAW").length;

  // Game length: BFS distance from start to each terminal (shortest path)
  // and also the max finite game length.
  const dist = new Map<string, number>();
  dist.set(startKey, 0);
  const bfsQueue: string[] = [startKey];
  while (bfsQueue.length > 0) {
    const k = bfsQueue.shift()!;
    const node = nodes.get(k)!;
    for (const succ of node.successors) {
      if (dist.get(succ) === undefined) {
        dist.set(succ, dist.get(k)! + 1);
        bfsQueue.push(succ);
      }
    }
  }
  const terminalDistances = terminalStates
    .map((k) => dist.get(k)!)
    .filter((d) => d !== undefined);
  const minGameLen = terminalDistances.length > 0 ? Math.min(...terminalDistances) : null;
  const maxShortestGameLen = terminalDistances.length > 0 ? Math.max(...terminalDistances) : null;

  // Dominant openings: moves from start and their resulting value (from opponent perspective)
  const openingMoves = getLegalMoves(start);
  const openingResults = openingMoves.map((m: Move) => {
    const after = applyMove(start, m);
    const afterKey = stateKey(after);
    const opponentValue = value.get(afterKey)!; // from perspective of player to move (opponent)
    const ourResult: GameValue =
      opponentValue === "LOSS" ? "WIN" : opponentValue === "WIN" ? "LOSS" : "DRAW";
    return { move: describeMove(m), ourResult };
  });

  // Forced win for starting player?
  const startIsWinForA = startValue === "WIN";

  // Repetition: count states reachable via more than one path
  // (States involved in cycles are exactly the DRAW states reachable from start)
  const reachableFromStart = new Set<string>([...dist.keys()]);
  const drawCyclesReachable = allKeys.filter(
    (k) => reachableFromStart.has(k) && value.get(k) === "DRAW",
  ).length;

  // Report
  console.log("=== Chopsticks classic-v1 Analysis ===\n");
  console.log(`Total reachable states: ${totalStates}`);
  console.log(`  Playing: ${playingStates}`);
  console.log(`  Terminal: ${terminalStates.length}`);
  console.log(`  Draw (cyclic/undetermined): ${drawCyclesReachable} reachable from start\n`);
  console.log(`Game-theoretic value (from start, player to move = A): ${startValue}`);
  console.log(`  Starting position ${startIsWinForA ? "is" : "is NOT"} a forced win for the first player.\n`);
  console.log(`Value distribution: WIN=${winCount} LOSS=${lossCount} DRAW=${drawCount}`);
  console.log("");
  console.log(`Game length (shortest path to any terminal):`);
  console.log(`  Min: ${minGameLen} moves`);
  console.log(`  Max (shortest): ${maxShortestGameLen} moves`);
  console.log("");
  console.log("Opening moves from A:[1,1] B:[1,1] turn:A:");
  for (const r of openingResults) {
    console.log(`  ${r.move} -> ${r.ourResult} (for A)`);
  }
  console.log("");
  console.log("Terminal states (first 20):");
  for (const k of terminalStates.slice(0, 20)) {
    console.log(`  ${describeState(nodes.get(k)!.state)} dist=${dist.get(k)}`);
  }
}

function describeMove(move: Move): string {
  if (move.type === "tap") {
    const target = move.targetPlayer === move.player ? "self" : move.targetPlayer;
    const sh = move.source === "left" ? "L" : "R";
    const th = move.target === "left" ? "L" : "R";
    return `tap ${sh} -> ${target} ${th}`;
  }
  return `split to R:${move.right} L:${move.left}`;
}

analyse();