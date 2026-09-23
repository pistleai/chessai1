import { Chess, PieceSymbol } from 'chess.js';

/**
 * Piece values in centipawns:
 * p = 100, n = 320, b = 330, r = 500, q = 900, k = 20000
 */
export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Piece-Square Tables (PST) from White's perspective.
 * Indexing: [row][col] where row 0 is Rank 8 and row 7 is Rank 1.
 * For Black, the row index is vertically mirrored (7 - row).
 */
export const PST: Record<PieceSymbol, number[][]> = {
  // Pawn: bonuses for advancing and central control, penalizing undeveloped center pawns
  p: [
    [  0,   0,   0,   0,   0,   0,   0,   0],
    [ 50,  50,  50,  50,  50,  50,  50,  50],
    [ 10,  10,  20,  30,  30,  20,  10,  10],
    [  5,   5,  10,  25,  25,  10,   5,   5],
    [  0,   0,   0,  20,  20,   0,   0,   0],
    [  5,  -5, -10,   0,   0, -10,  -5,   5],
    [  5,  10,  10, -20, -20,  10,  10,   5],
    [  0,   0,   0,   0,   0,   0,   0,   0],
  ],
  // Knight: heavily rewards central placement (d4, d5, e4, e5), penalizes rim/corners
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20,   0,   0,   0,   0, -20, -40],
    [-30,   0,  10,  15,  15,  10,   0, -30],
    [-30,   5,  15,  20,  20,  15,   5, -30],
    [-30,   0,  15,  20,  20,  15,   0, -30],
    [-30,   5,  10,  15,  15,  10,   5, -30],
    [-40, -20,   0,   5,   5,   0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  // Bishop: rewards open diagonals and central control
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,  10,  10,   5,   0, -10],
    [-10,   5,   5,  10,  10,   5,   5, -10],
    [-10,   0,  10,  10,  10,  10,   0, -10],
    [-10,  10,  10,  10,  10,  10,  10, -10],
    [-10,   5,   0,   0,   0,   0,   5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  // Rook: rewards 7th rank and centralized files
  r: [
    [  0,   0,   0,   0,   0,   0,   0,   0],
    [  5,  10,  10,  10,  10,  10,  10,   5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [  0,   0,   0,   5,   5,   0,   0,   0],
  ],
  // Queen: favors active central positions, avoids early vulnerability
  q: [
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,   5,   5,   5,   0, -10],
    [ -5,   0,   5,   5,   5,   5,   0,  -5],
    [  0,   0,   5,   5,   5,   5,   0,  -5],
    [-10,   5,   5,   5,   5,   5,   0, -10],
    [-10,   0,   5,   0,   0,   0,   0, -10],
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
  ],
  // King (middlegame): favors castling/pawn shelter, penalizes exposed king
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [ 20,  20,   0,   0,   0,   0,  20,  20],
    [ 20,  30,  10,   0,   0,  10,  30,  20],
  ],
};

/**
 * King table for endgame: rewards active king centralization
 */
export const KING_ENDGAME_TABLE: number[][] = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10,   0,   0, -10, -20, -30],
  [-30, -10,  20,  30,  30,  20, -10, -30],
  [-30, -10,  30,  40,  40,  30, -10, -30],
  [-30, -10,  30,  40,  40,  30, -10, -30],
  [-30, -10,  20,  30,  30,  20, -10, -30],
  [-30, -30,   0,   0,   0,   0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];

/**
 * Determines whether the position has entered an endgame.
 * True when both sides have no queens, or when non-pawn material is minimal.
 */
export function isEndgame(game: Chess): boolean {
  let queens = 0;
  let minorPieces = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.type === 'q') queens++;
      if (piece.type === 'r' || piece.type === 'b' || piece.type === 'n') minorPieces++;
    }
  }

  return queens === 0 || (queens <= 2 && minorPieces <= 2);
}

/**
 * Evaluates the board position combining material balance and Piece-Square Tables (PST).
 *
 * Contract:
 * - If game.isCheckmate(), returns -Infinity.
 * - If game.isDraw(), returns 0.
 * - Sums material and positional PST bonuses for all pieces (White positive, Black negative,
 *   using vertically-mirrored indices for Black pieces).
 * - Returns score from the perspective of the CURRENT side to move (positive is good for whoever moves next).
 *
 * @param game The current Chess instance
 * @returns Score from current side-to-move's perspective
 */
export function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return -Infinity;
  }

  if (game.isDraw()) {
    return 0;
  }

  let whiteScore = 0;
  let blackScore = 0;
  const board = game.board();
  const endgame = isEndgame(game);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const materialVal = PIECE_VALUES[piece.type] ?? 0;
      let pstVal = 0;

      if (piece.type === 'k' && endgame) {
        pstVal = piece.color === 'w'
          ? KING_ENDGAME_TABLE[r][c]
          : KING_ENDGAME_TABLE[7 - r][c];
      } else {
        const table = PST[piece.type];
        pstVal = piece.color === 'w'
          ? table[r][c]
          : table[7 - r][c];
      }

      const totalVal = materialVal + pstVal;
      if (piece.color === 'w') {
        whiteScore += totalVal;
      } else {
        blackScore += totalVal;
      }
    }
  }

  const score = whiteScore - blackScore;
  return game.turn() === 'w' ? score : -score;
}

/**
 * Pure material-only evaluation without PST bonuses.
 */
export function evaluateMaterial(game: Chess): number {
  if (game.isCheckmate()) return -Infinity;
  if (game.isDraw()) return 0;

  let material = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = PIECE_VALUES[piece.type] ?? 0;
        material += piece.color === 'w' ? val : -val;
      }
    }
  }
  return game.turn() === 'w' ? material : -material;
}

/**
 * Helper to evaluate a board directly from a FEN string.
 *
 * @param fen FEN string of the chess position
 * @returns Score from the current side-to-move's perspective
 */
export function evaluateBoard(fen: string): number {
  const game = new Chess(fen);
  return evaluate(game);
}

/**
 * Evaluates the board position strictly from White's perspective (+ = White advantage, - = Black advantage).
 * Useful for GUI EvalBar displays and analysis meters.
 *
 * @param game The current Chess instance
 * @returns Score from White's perspective in centipawns
 */
export function evaluateWhitePerspective(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -Infinity : Infinity;
  }
  if (game.isDraw()) {
    return 0;
  }
  const sideToMoveScore = evaluate(game);
  return game.turn() === 'w' ? sideToMoveScore : -sideToMoveScore;
}

/**
 * Calculates continuous game phase between 0.0 (pure endgame) and 1.0 (opening/middlegame).
 * Non-pawn piece weights: Knight=1, Bishop=1, Rook=2, Queen=4. Total for both sides = 24.
 */
export function getGamePhase(game: Chess): number {
  let totalWeight = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.type === 'n' || piece.type === 'b') totalWeight += 1;
      else if (piece.type === 'r') totalWeight += 2;
      else if (piece.type === 'q') totalWeight += 4;
    }
  }

  return Math.min(1, Math.max(0, totalWeight / 24));
}

export interface EvaluationBreakdown {
  whiteMaterial: number;
  blackMaterial: number;
  materialDiff: number;
  whitePST: number;
  blackPST: number;
  pstDiff: number;
  totalScore: number;            // side-to-move perspective (engine internal)
  whitePerspectiveScore: number; // ALWAYS use this for UI display
  gamePhase: number;             // 0.0 = pure endgame, 1.0 = opening/middlegame
}

/**
 * Generates transparent mathematical breakdown of the static evaluation function.
 */
export function getEvaluationBreakdown(game: Chess): EvaluationBreakdown {
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whitePST = 0;
  let blackPST = 0;

  const board = game.board();
  const endgame = isEndgame(game);
  const phase = getGamePhase(game);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const materialVal = PIECE_VALUES[piece.type] ?? 0;
      let pstVal = 0;

      if (piece.type === 'k' && endgame) {
        pstVal = piece.color === 'w'
          ? KING_ENDGAME_TABLE[r][c]
          : KING_ENDGAME_TABLE[7 - r][c];
      } else {
        const table = PST[piece.type];
        pstVal = piece.color === 'w'
          ? table[r][c]
          : table[7 - r][c];
      }

      if (piece.color === 'w') {
        whiteMaterial += materialVal;
        whitePST += pstVal;
      } else {
        blackMaterial += materialVal;
        blackPST += pstVal;
      }
    }
  }

  const materialDiff = whiteMaterial - blackMaterial;
  const pstDiff = whitePST - blackPST;
  const totalScoreSide = evaluate(game);
  const whitePerspectiveScore = evaluateWhitePerspective(game);

  return {
    whiteMaterial,
    blackMaterial,
    materialDiff,
    whitePST,
    blackPST,
    pstDiff,
    totalScore: totalScoreSide,
    whitePerspectiveScore,
    gamePhase: Number(phase.toFixed(2)),
  };
}

