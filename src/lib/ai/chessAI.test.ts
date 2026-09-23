import { Chess } from 'chess.js';
import { orderMoves, getBestMove, findBestMove } from './chessAI';

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [
  {
    name: 'orderMoves sorts captures first and higher victim values first (MVV)',
    fn: () => {
      // White has options to capture a Queen, Rook, and Pawn, plus quiet moves
      // FEN: Black queen on d5, black rook on f5, black pawn on b5, white knight on c3
      const game = new Chess('r3kbnr/ppp1pppp/8/1q1r1b2/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1');
      const moves = game.moves({ verbose: true });
      const ordered = orderMoves(moves);

      // Verify that all captures come before all non-captures
      let seenNonCapture = false;
      for (const m of ordered) {
        if (m.captured) {
          if (seenNonCapture) {
            throw new Error(`Found capture ${m.san} after non-capture move in ordered list`);
          }
        } else {
          seenNonCapture = true;
        }
      }

      // Verify that captures are ordered in descending order of victim value
      const captureVictimValues = ordered
        .filter((m) => !!m.captured)
        .map((m) => {
          if (m.captured === 'q') return 900;
          if (m.captured === 'r') return 500;
          if (m.captured === 'b') return 330;
          if (m.captured === 'n') return 320;
          if (m.captured === 'p') return 100;
          return 0;
        });

      for (let i = 0; i < captureVictimValues.length - 1; i++) {
        if (captureVictimValues[i] < captureVictimValues[i + 1]) {
          throw new Error('Captures are not sorted in descending order of victim value');
        }
      }
    },
  },
  {
    name: 'Starting position returns a valid legal move',
    fn: () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const move = getBestMove(fen, 3);
      if (!move) {
        throw new Error('Expected a legal move from starting position, got null');
      }
      const game = new Chess(fen);
      const legalMoves = game.moves({ verbose: true });
      const isLegal = legalMoves.some((m) => m.lan === move.lan);
      if (!isLegal) {
        throw new Error(`Returned move ${move.san} is not legal in the starting position`);
      }
    },
  },
  {
    name: 'Finds free hanging queen capture as White (Nxe4)',
    fn: () => {
      // Black has undefended queen on e4, White knight on c3 can capture it
      const fen = 'rnb1kbnr/pppp1ppp/8/8/4q3/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
      const move = getBestMove(fen, 3);
      if (!move) {
        throw new Error('Expected move, got null');
      }
      if (move.to !== 'e4' || move.captured !== 'q') {
        throw new Error(`Expected queen capture on e4 (Nxe4), but got ${move.san}`);
      }
    },
  },
  {
    name: 'Finds free hanging queen capture as Black (Nxe4)',
    fn: () => {
      // White has undefended queen on e4, Black knight on f6 can capture it
      const fen = 'rnbqkb1r/pppppppp/5n2/8/4Q3/8/PPPPPPPP/RNB1KBNR b KQkq - 1 2';
      const move = getBestMove(fen, 3);
      if (!move) {
        throw new Error('Expected move, got null');
      }
      if (move.to !== 'e4' || move.captured !== 'q') {
        throw new Error(`Expected queen capture on e4 (Nxe4 for Black), but got ${move.san}`);
      }
    },
  },
  {
    name: "Finds Scholar's mate in 1 as White (Qxf7#)",
    fn: () => {
      // White queen on f3, bishop on c4, Qxf7# is immediate checkmate
      const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
      const move = getBestMove(fen, 3);
      if (!move) {
        throw new Error('Expected mate-in-1 move, got null');
      }
      if (move.san !== 'Qxf7#' && (move.from !== 'f3' || move.to !== 'f7')) {
        throw new Error(`Expected Qxf7#, but got ${move.san}`);
      }
    },
  },
  {
    name: "Finds Fool's mate in 1 as Black (Qh4#)",
    fn: () => {
      // 1. f3 e5 2. g4 Qh4# (immediate mate for Black)
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
      const move = getBestMove(fen, 3);
      if (!move) {
        throw new Error('Expected mate-in-1 move, got null');
      }
      if (move.san !== 'Qh4#' && (move.from !== 'd8' || move.to !== 'h4')) {
        throw new Error(`Expected Qh4#, but got ${move.san}`);
      }
    },
  },
  {
    name: 'Returns null on game over position (already checkmated)',
    fn: () => {
      // Fool's mate reached
      const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const move = getBestMove(fen, 3);
      if (move !== null) {
        throw new Error(`Expected null for checkmated position, got ${move.san}`);
      }
    },
  },
  {
    name: 'findBestMove helper returns accurate engine metrics (nodes, depth, evaluation)',
    fn: () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
      const result = findBestMove(fen, 3);
      if (!result.bestMove || result.bestMove.san !== 'Qxf7#') {
        throw new Error(`Expected Qxf7#, got ${result.bestMove?.san}`);
      }
      if (result.nodes <= 0) {
        throw new Error(`Expected nodes > 0, got ${result.nodes}`);
      }
      if (result.evaluation !== Infinity) {
        throw new Error(`Expected Infinity for checkmate, got ${result.evaluation}`);
      }
    },
  },
];

console.log('--- Running Chess Negamax AI Unit Tests ---');
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
