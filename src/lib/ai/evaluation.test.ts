import { Chess } from 'chess.js';
import { evaluate, evaluateMaterial, PIECE_VALUES, PST, KING_ENDGAME_TABLE } from './evaluation';

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [
  {
    name: 'PIECE_VALUES exact contract check',
    fn: () => {
      if (
        PIECE_VALUES.p !== 100 ||
        PIECE_VALUES.n !== 320 ||
        PIECE_VALUES.b !== 330 ||
        PIECE_VALUES.r !== 500 ||
        PIECE_VALUES.q !== 900 ||
        PIECE_VALUES.k !== 20000
      ) {
        throw new Error(`PIECE_VALUES mismatch: ${JSON.stringify(PIECE_VALUES)}`);
      }
    },
  },
  {
    name: 'PST definitions exist for all 6 piece types with 8x8 tables',
    fn: () => {
      for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
        const table = PST[piece];
        if (!table || table.length !== 8 || table.some((row) => row.length !== 8)) {
          throw new Error(`Invalid PST table dimensions for piece: ${piece}`);
        }
      }
      if (!KING_ENDGAME_TABLE || KING_ENDGAME_TABLE.length !== 8 || KING_ENDGAME_TABLE.some((r) => r.length !== 8)) {
        throw new Error('Invalid KING_ENDGAME_TABLE dimensions');
      }
    },
  },
  {
    name: 'Starting position evaluates to 0 (equal material + symmetric mirrored PST)',
    fn: () => {
      const game = new Chess();
      const score = evaluate(game);
      if (score !== 0) {
        throw new Error(`Expected starting position score 0, got: ${score}`);
      }
    },
  },
  {
    name: 'White up a queen evaluates strongly positive (> 800) from White turn',
    fn: () => {
      const game = new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      const score = evaluate(game);
      if (score < 800) {
        throw new Error(`Expected > 800 when White is up a queen on White's turn, got: ${score}`);
      }
    },
  },
  {
    name: "Perspective flips to negative when White is up a queen but it's Black's turn",
    fn: () => {
      const gameWhite = new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      const gameBlack = new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
      const whiteScore = evaluate(gameWhite);
      const blackScore = evaluate(gameBlack);
      if (blackScore !== -whiteScore) {
        throw new Error(`Expected blackScore (${blackScore}) to be -whiteScore (${-whiteScore})`);
      }
    },
  },
  {
    name: "Black up a queen evaluates strongly positive (> 800) from Black's turn",
    fn: () => {
      const game = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1');
      const score = evaluate(game);
      if (score < 800) {
        throw new Error(`Expected > 800 when Black is up a queen on Black's turn, got: ${score}`);
      }
    },
  },
  {
    name: 'Checkmate returns -Infinity (side to move is checkmated - Fool\'s Mate)',
    fn: () => {
      const game = new Chess();
      game.move('f3');
      game.move('e5');
      game.move('g4');
      game.move('Qh4');
      if (!game.isCheckmate()) {
        throw new Error('Expected position to be checkmate');
      }
      const score = evaluate(game);
      if (score !== -Infinity) {
        throw new Error(`Expected -Infinity for checkmate, got: ${score}`);
      }
    },
  },
  {
    name: 'Checkmate returns -Infinity (Scholar\'s Mate, Black checkmated)',
    fn: () => {
      const game = new Chess();
      game.move('e4');
      game.move('e5');
      game.move('Qh5');
      game.move('Nc6');
      game.move('Bc4');
      game.move('Nf6');
      game.move('Qxf7');
      if (!game.isCheckmate()) {
        throw new Error('Expected position to be checkmate');
      }
      const score = evaluate(game);
      if (score !== -Infinity) {
        throw new Error(`Expected -Infinity for checkmated Black, got: ${score}`);
      }
    },
  },
  {
    name: 'Draw by stalemate evaluates to 0',
    fn: () => {
      const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
      if (!game.isDraw() || !game.isStalemate()) {
        throw new Error('Expected stalemate');
      }
      const score = evaluate(game);
      if (score !== 0) {
        throw new Error(`Expected 0 for stalemate, got: ${score}`);
      }
    },
  },
  {
    name: 'Draw by insufficient material evaluates to 0',
    fn: () => {
      const game = new Chess('8/8/8/4k3/8/4K3/8/8 w - - 0 1');
      if (!game.isDraw() || !game.isInsufficientMaterial()) {
        throw new Error('Expected draw by insufficient material');
      }
      const score = evaluate(game);
      if (score !== 0) {
        throw new Error(`Expected 0 for insufficient material, got: ${score}`);
      }
    },
  },
  {
    name: 'PST: Central knight evaluates higher than rim knight on identical material',
    fn: () => {
      // White knight on central d4 vs rim a4 (with pawns on a2/a7 so position is not draw by insufficient material)
      const centralKnightFen = '8/p7/8/8/3N4/8/P7/4K2k w - - 0 1';
      const rimKnightFen = '8/p7/8/8/N7/8/P7/4K2k w - - 0 1';
      const centralScore = evaluate(new Chess(centralKnightFen));
      const rimScore = evaluate(new Chess(rimKnightFen));
      if (centralScore <= rimScore) {
        throw new Error(`Expected central knight (${centralScore}) to score higher than rim knight (${rimScore})`);
      }
    },
  },
  {
    name: 'evaluateMaterial provides pure material baseline',
    fn: () => {
      const game = new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      const mat = evaluateMaterial(game);
      if (mat !== 900) {
        throw new Error(`Expected exact material score 900, got: ${mat}`);
      }
    },
  },
];

console.log('--- Running Chess Evaluation Unit Tests ---');
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
