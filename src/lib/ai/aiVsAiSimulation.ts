import { Chess } from 'chess.js';
import { getBestMove } from './chessAI';
import { evaluate } from './evaluation';

/**
 * Simulates AI vs AI games to verify positional awareness and central piece development.
 */
function playAiGame(depth = 3, maxPlies = 10): { moves: string[]; fen: string } {
  const game = new Chess();
  const moves: string[] = [];

  for (let ply = 0; ply < maxPlies; ply++) {
    if (game.isGameOver()) break;
    const bestMove = getBestMove(game.fen(), depth);
    if (!bestMove) break;
    game.move(bestMove);
    moves.push(bestMove.san);
  }

  return { moves, fen: game.fen() };
}

console.log('=== Running AI vs AI Game Simulations (Depth 3 with PST) ===\n');

// Game 1: Standard opening play
console.log('--- Game 1: Opening Moves (first 8 plies) ---');
const game1 = playAiGame(3, 8);
for (let i = 0; i < game1.moves.length; i += 2) {
  const moveNum = Math.floor(i / 2) + 1;
  const white = game1.moves[i];
  const black = game1.moves[i + 1] || '';
  console.log(`${moveNum}. ${white.padEnd(6)} ${black}`);
}
console.log(`Final FEN: ${game1.fen}\n`);

// Positional Test: Knight placement test
console.log('--- Positional Test: Knight Choice in Equal Material Position ---');
// Position where White can play either Nc3 (centralizing) or Na3 (rim) or quiet pawn move
const knightFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const chosenMove = getBestMove(knightFen, 3);
console.log(`From 1. e4 e5, White's chosen move: ${chosenMove?.san}`);

// Positional Test: Proving central placement is favored over rim
const cCentral = new Chess('8/p7/8/8/3N4/8/P7/4K2k w - - 0 1'); // Nd4 (central)
const cRim = new Chess('8/p7/8/8/N7/8/P7/4K2k w - - 0 1');     // Na4 (rim)
const evalCentral = evaluate(cCentral);
const evalRim = evaluate(cRim);

console.log(`\nEqual Material Comparison:`);
console.log(`White Knight on central d4 score: ${evalCentral}`);
console.log(`White Knight on rim a4 score:     ${evalRim}`);
console.log(`Centralization premium:          +${evalCentral - evalRim} centipawns`);

if (evalCentral > evalRim) {
  console.log('\n[SUCCESS] AI clearly favors active/centralized placement over passive rim placement!');
} else {
  console.error('\n[FAIL] Centralization was not favored.');
  process.exit(1);
}
