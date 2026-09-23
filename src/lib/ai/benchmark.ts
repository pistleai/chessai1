import { Chess, Move } from 'chess.js';
import { evaluate, PIECE_VALUES } from './evaluation';
import { getPositionKey } from './transposition';

interface BenchmarkResult {
  nodes: number;
  timeMs: number;
  bestMove: string;
  score: number;
}

function orderMoves(moves: Move[], ttMove?: Move | null): Move[] {
  return [...moves].sort((a, b) => {
    if (ttMove) {
      const aIsTT = a.lan === ttMove.lan || (a.from === ttMove.from && a.to === ttMove.to);
      const bIsTT = b.lan === ttMove.lan || (b.from === ttMove.from && b.to === ttMove.to);
      if (aIsTT && !bIsTT) return -1;
      if (!aIsTT && bIsTT) return 1;
    }
    const aVal = a.captured ? (PIECE_VALUES[a.captured] ?? 0) : 0;
    const bVal = b.captured ? (PIECE_VALUES[b.captured] ?? 0) : 0;
    return bVal - aVal;
  });
}

function quiesce(
  game: Chess,
  alpha: number,
  beta: number,
  countNode: () => void,
  maxQDepth: number = 6
): number {
  countNode();
  if (game.isGameOver()) return evaluate(game);

  const standPat = evaluate(game);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (maxQDepth <= 0) return alpha;

  const inCheck = game.inCheck();
  const candidates = inCheck
    ? game.moves({ verbose: true })
    : game.moves({ verbose: true }).filter((m) => !!m.captured);

  if (candidates.length === 0) return inCheck ? -Infinity : alpha;

  const ordered = orderMoves(candidates);
  for (const m of ordered) {
    game.move(m);
    const score = -quiesce(game, -beta, -alpha, countNode, maxQDepth - 1);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// Search WITHOUT Transposition Table
function searchWithoutTT(fen: string, depth: number): BenchmarkResult {
  let nodes = 0;
  const countNode = () => { nodes++; };

  function negamaxNoTT(g: Chess, d: number, a: number, b: number): number {
    countNode();
    if (g.isGameOver()) return evaluate(g);
    if (d === 0) return quiesce(g, a, b, countNode);

    const moves = orderMoves(g.moves({ verbose: true }));
    let maxScore = -Infinity;

    for (const m of moves) {
      g.move(m);
      const score = -negamaxNoTT(g, d - 1, -b, -a);
      g.undo();

      if (score > maxScore) maxScore = score;
      if (score > a) a = score;
      if (a >= b) break;
    }
    return maxScore;
  }

  const startTime = Date.now();
  const game = new Chess(fen);
  const moves = orderMoves(game.moves({ verbose: true }));

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of moves) {
    countNode();
    game.move(m);
    const score = -negamaxNoTT(game, depth - 1, -beta, -alpha);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }

  return {
    nodes,
    timeMs: Date.now() - startTime,
    bestMove: bestMove.san,
    score: bestScore,
  };
}

// Search WITH Transposition Table
function searchWithTT(fen: string, depth: number): BenchmarkResult {
  let nodes = 0;
  const countNode = () => { nodes++; };
  const tt = new Map<string, { depth: number; score: number; flag: 'exact' | 'lower' | 'upper'; bestMove?: Move | null }>();

  function negamaxWithTT(g: Chess, d: number, a: number, b: number): number {
    countNode();
    if (g.isGameOver()) return evaluate(g);
    if (d === 0) return quiesce(g, a, b, countNode);

    const key = getPositionKey(g.fen());
    const entry = tt.get(key);

    if (entry && entry.depth >= d) {
      if (entry.flag === 'exact') return entry.score;
      if (entry.flag === 'lower' && entry.score >= b) return entry.score;
      if (entry.flag === 'upper' && entry.score <= a) return entry.score;
    }

    const origA = a;
    const moves = orderMoves(g.moves({ verbose: true }), entry?.bestMove);
    let maxScore = -Infinity;
    let nodeBestMove: Move | null = null;

    for (const m of moves) {
      g.move(m);
      const score = -negamaxWithTT(g, d - 1, -b, -a);
      g.undo();

      if (score > maxScore) {
        maxScore = score;
        nodeBestMove = m;
      }
      if (score > a) a = score;
      if (a >= b) break;
    }

    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    if (maxScore <= origA) flag = 'upper';
    else if (maxScore >= b) flag = 'lower';

    if (!entry || d >= entry.depth) {
      tt.set(key, { depth: d, score: maxScore, flag, bestMove: nodeBestMove });
    }

    return maxScore;
  }

  const startTime = Date.now();
  const game = new Chess(fen);
  const rootKey = getPositionKey(fen);
  const rootEntry = tt.get(rootKey);
  const moves = orderMoves(game.moves({ verbose: true }), rootEntry?.bestMove);

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of moves) {
    countNode();
    game.move(m);
    const score = -negamaxWithTT(game, depth - 1, -beta, -alpha);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }

  return {
    nodes,
    timeMs: Date.now() - startTime,
    bestMove: bestMove.san,
    score: bestScore,
  };
}

console.log('===============================================================');
console.log('  CHESS ENGINE BENCHMARK: DEPTH 4 SEARCH (STARTING POSITION)');
console.log('===============================================================\n');

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

console.log('Running search WITHOUT Transposition Table (Depth 4)...');
const withoutTT = searchWithoutTT(startFen, 4);
console.log(`[Without TT] Nodes: ${withoutTT.nodes.toLocaleString()} | Time: ${withoutTT.timeMs}ms | Best Move: ${withoutTT.bestMove} | Score: ${withoutTT.score}`);

console.log('\nRunning search WITH Transposition Table (Depth 4)...');
const withTT = searchWithTT(startFen, 4);
console.log(`[With TT]    Nodes: ${withTT.nodes.toLocaleString()} | Time: ${withTT.timeMs}ms | Best Move: ${withTT.bestMove} | Score: ${withTT.score}`);

const nodeDiff = withoutTT.nodes - withTT.nodes;
const nodePct = ((nodeDiff / withoutTT.nodes) * 100).toFixed(1);
const timeDiff = withoutTT.timeMs - withTT.timeMs;
const timePct = ((timeDiff / withoutTT.timeMs) * 100).toFixed(1);

console.log('\n---------------------------------------------------------------');
console.log(`RESULTS COMPARISON:`);
console.log(`Nodes Searched: ${withoutTT.nodes.toLocaleString()} -> ${withTT.nodes.toLocaleString()} (reduced by ${nodeDiff.toLocaleString()} nodes, -${nodePct}%)`);
console.log(`Search Time:    ${withoutTT.timeMs}ms -> ${withTT.timeMs}ms (${timeDiff >= 0 ? '-' : '+'}${Math.abs(timeDiff)}ms, ${timePct}%)`);
console.log('---------------------------------------------------------------');
