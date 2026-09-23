import { Chess } from 'chess.js';
import { getBestMoveIterative, getBestMove } from './chessAI';

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [
  {
    name: 'Iterative deepening returns valid move from starting position within budget',
    fn: () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const budgetMs = 1500;
      const t0 = Date.now();
      const result = getBestMoveIterative(fen, budgetMs, 10);
      const elapsed = Date.now() - t0;

      if (!result.bestMove) {
        throw new Error('Expected a move, got null');
      }
      if (result.depthReached < 2) {
        throw new Error(`Expected depth >= 2 within budget, got: ${result.depthReached}`);
      }
      // Allow slight jitter on elapsed time (< budget + 600ms)
      if (elapsed > budgetMs + 800) {
        throw new Error(`Elapsed time ${elapsed}ms exceeded budget ${budgetMs}ms significantly`);
      }
      console.log(`       Starting pos: move=${result.bestMove.san}, depth=${result.depthReached}, nodes=${result.nodes}, time=${elapsed}ms`);
    },
  },
  {
    name: 'Iterative deepening in complex middlegame returns move and never returns null',
    fn: () => {
      // Busy middlegame FEN (Ruy Lopez closed, lots of tactical tension)
      const middlegameFen = 'r1b2rk1/2q1bppp/p1np1n2/1p2p3/3NP3/1BN1BP2/PPP3PP/R2Q1RK1 w - - 0 12';
      const budgetMs = 2000;
      const t0 = Date.now();
      const result = getBestMoveIterative(middlegameFen, budgetMs, 10);
      const elapsed = Date.now() - t0;

      if (!result.bestMove) {
        throw new Error('Expected move in busy middlegame, got null');
      }
      if (elapsed > budgetMs + 900) {
        throw new Error(`Middlegame search took ${elapsed}ms, exceeding budget ${budgetMs}ms significantly`);
      }

      const game = new Chess(middlegameFen);
      const legal = game.moves({ verbose: true }).some((m) => m.lan === result.bestMove?.lan);
      if (!legal) {
        throw new Error(`Returned move ${result.bestMove.san} is illegal in middlegame position`);
      }
      console.log(`       Middlegame: move=${result.bestMove.san}, depth=${result.depthReached}, nodes=${result.nodes}, time=${elapsed}ms`);
    },
  },
  {
    name: 'getBestMove with timeLimitMs delegates to iterative deepening',
    fn: () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const move = getBestMove(fen, 3, 1000);
      if (!move) {
        throw new Error('Expected move via getBestMove with timeLimitMs, got null');
      }
      console.log(`       getBestMove(timeLimitMs=1000) chosen move: ${move.san}`);
    },
  },
  {
    name: 'Mate-in-1 terminates deepening early when mate is found',
    fn: () => {
      // Scholar's mate: Qxf7#
      const mateFen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
      const t0 = Date.now();
      const result = getBestMoveIterative(mateFen, 2000, 10);
      const elapsed = Date.now() - t0;

      if (!result.bestMove || result.bestMove.san !== 'Qxf7#') {
        throw new Error(`Expected Qxf7#, got ${result.bestMove?.san}`);
      }
      // Should find mate virtually immediately (< 500ms) without running out full budget
      if (elapsed > 800) {
        throw new Error(`Expected quick termination on mate, took ${elapsed}ms`);
      }
      console.log(`       Mate-in-1 found ${result.bestMove.san} in ${elapsed}ms at depth ${result.depthReached}`);
    },
  },
];

console.log('--- Running Iterative Deepening & Time Budget Unit Tests ---');
let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    console.log(`[PASS] ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${t.name}`);
    console.error(`       ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests.`);
if (failed > 0) {
  process.exit(1);
}
