import { Chess, Move } from 'chess.js';
import { evaluate, PIECE_VALUES } from './evaluation';
import {
  transpositionTable,
  getPositionKey,
  TTFlag,
} from './transposition';

export interface AISearchResult {
  bestMove: Move | null;
  evaluation: number;
  depth: number;
  nodes: number;
}

export interface IterativeSearchResult {
  bestMove: Move | null;
  score: number;
  depthReached: number;
  nodes: number;
  timeMs: number;
}

/**
 * Orders legal moves to maximize alpha-beta cutoffs.
 * Priority:
 * 1. Transposition Table best move from prior search / shallower depth.
 * 2. Captures sorted by MVV (Most Valuable Victim: Q > R > B > N > P).
 * 3. Quiet moves.
 *
 * @param moves Array of verbose Move objects
 * @param ttMove Optional best move recorded in Transposition Table or previous iteration
 * @returns Sorted array of Move objects
 */
export function orderMoves(moves: Move[], ttMove?: Move | null): Move[] {
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

/**
 * Quiescence search evaluates only tactical capture moves (and check escapes)
 * at the leaf of the minimax tree. Mitigates the horizon effect.
 *
 * @param game Active Chess instance
 * @param alpha Lower bound score
 * @param beta Upper bound score
 * @param onNode Optional node counter callback
 * @param maxQDepth Maximum capture recursion plies (default: 6)
 * @returns Score from current side-to-move's perspective
 */
export function quiesce(
  game: Chess,
  alpha: number,
  beta: number,
  onNode?: () => boolean,
  maxQDepth: number = 6
): number {
  if (onNode && onNode()) return 0;
  if (game.isGameOver()) return evaluate(game);

  const standPat = evaluate(game);

  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (maxQDepth <= 0) return alpha;

  const inCheck = game.inCheck();
  const candidateMoves = inCheck
    ? game.moves({ verbose: true })
    : game.moves({ verbose: true }).filter((m) => !!m.captured);

  if (candidateMoves.length === 0) {
    return inCheck ? -Infinity : alpha;
  }

  const orderedCaptures = orderMoves(candidateMoves);

  for (const move of orderedCaptures) {
    game.move(move);
    const score = -quiesce(game, -beta, -alpha, onNode, maxQDepth - 1);
    game.undo();

    if (onNode && onNode()) return 0;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * Recursive Negamax search with Alpha-Beta pruning, Transposition Table lookup,
 * and time-checking capability.
 *
 * @param game Active Chess game instance
 * @param depth Remaining search depth
 * @param alpha Lower bound score
 * @param beta Upper bound score
 * @param onNode Optional node callback, returns true if time budget exceeded
 * @returns Best score achievable from this position
 */
export function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  onNode?: () => boolean
): number {
  if (onNode && onNode()) return 0;
  if (game.isGameOver()) return evaluate(game);
  if (depth === 0) return quiesce(game, alpha, beta, onNode);

  // Transposition Table lookup
  const key = getPositionKey(game.fen());
  const entry = transpositionTable.get(key);

  if (entry && entry.depth >= depth) {
    if (entry.flag === 'exact') return entry.score;
    if (entry.flag === 'lower' && entry.score >= beta) return entry.score;
    if (entry.flag === 'upper' && entry.score <= alpha) return entry.score;
  }

  const origAlpha = alpha;
  const moves = orderMoves(game.moves({ verbose: true }), entry?.bestMove);
  let maxScore = -Infinity;
  let bestMoveForNode: Move | null = null;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha, onNode);
    game.undo();

    if (onNode && onNode()) return 0;

    if (score > maxScore) {
      maxScore = score;
      bestMoveForNode = move;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break; // Alpha-beta cutoff
    }
  }

  // Determine TT flag
  let flag: TTFlag = 'exact';
  if (maxScore <= origAlpha) {
    flag = 'upper';
  } else if (maxScore >= beta) {
    flag = 'lower';
  }

  // Store entry in Transposition Table
  if (!entry || depth >= entry.depth) {
    transpositionTable.set(key, {
      depth,
      score: maxScore,
      flag,
      bestMove: bestMoveForNode,
    });
  }

  return maxScore;
}

/**
 * Iterative Deepening search with a strict time budget.
 *
 * Starts searching at depth 1, then depth 2, then depth 3...
 * At each new depth, orders the previous iteration's best move to the front
 * of the move list for optimal alpha-beta cutoffs.
 *
 * If the time budget is exceeded mid-search, gracefully stops and returns
 * the best move found from the deepest fully completed iteration.
 *
 * @param fen FEN string representing the position
 * @param timeLimitMs Time budget in milliseconds (default: 2000ms)
 * @param maxDepth Maximum depth ceiling (default: 20)
 * @returns IterativeSearchResult with the best move and search metrics
 */
export function getBestMoveIterative(
  fen: string,
  timeLimitMs: number = 2000,
  maxDepth: number = 20
): IterativeSearchResult {
  const game = new Chess(fen);
  if (game.isGameOver()) {
    return {
      bestMove: null,
      score: evaluate(game),
      depthReached: 0,
      nodes: 0,
      timeMs: 0,
    };
  }

  const legalMoves = orderMoves(game.moves({ verbose: true }));
  if (legalMoves.length === 0) {
    return {
      bestMove: null,
      score: evaluate(game),
      depthReached: 0,
      nodes: 0,
      timeMs: 0,
    };
  }

  const startTime = Date.now();
  const deadline = startTime + timeLimitMs;

  let totalNodes = 0;
  let bestOverallMove: Move = legalMoves[0];
  let bestOverallScore = -Infinity;
  let completedDepth = 0;
  let isTimeUp = false;

  // Lightweight periodic time checker (checks every 1024 nodes)
  const checkTime = (): boolean => {
    totalNodes++;
    if ((totalNodes & 1023) === 0) {
      if (Date.now() >= deadline) {
        isTimeUp = true;
      }
    }
    return isTimeUp;
  };

  for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
    if (Date.now() >= deadline) {
      break;
    }

    let iterationBestMove: Move = bestOverallMove;
    let iterationBestScore = -Infinity;
    let iterationAlpha = -Infinity;
    const iterationBeta = Infinity;

    // Order root moves with previous iteration's best move at the very front
    const currentMoves = orderMoves(legalMoves, bestOverallMove);
    let iterationCompleted = true;

    for (const move of currentMoves) {
      if (checkTime()) {
        iterationCompleted = false;
        break;
      }

      game.move(move);
      const score = -negamax(
        game,
        currentDepth - 1,
        -iterationBeta,
        -iterationAlpha,
        checkTime
      );
      game.undo();

      if (isTimeUp) {
        iterationCompleted = false;
        break;
      }

      if (score > iterationBestScore) {
        iterationBestScore = score;
        iterationBestMove = move;
      }
      if (score > iterationAlpha) {
        iterationAlpha = score;
      }
    }

    if (iterationCompleted) {
      bestOverallMove = iterationBestMove;
      bestOverallScore = iterationBestScore;
      completedDepth = currentDepth;

      // Checkmate found: no need to search deeper
      if (bestOverallScore === Infinity || bestOverallScore === -Infinity) {
        break;
      }
    } else {
      // Time expired mid-iteration; preserve bestOverallMove from previous completed depth
      break;
    }
  }

  // Update root position in TT
  const rootKey = getPositionKey(fen);
  transpositionTable.set(rootKey, {
    depth: completedDepth,
    score: bestOverallScore,
    flag: 'exact',
    bestMove: bestOverallMove,
  });

  return {
    bestMove: bestOverallMove,
    score: bestOverallScore,
    depthReached: completedDepth,
    nodes: totalNodes,
    timeMs: Date.now() - startTime,
  };
}

/**
 * Entry point for AI move selection.
 * Supports fixed-depth search or time-limited iterative deepening.
 *
 * @param fen FEN string representing the position
 * @param depth Search depth (default: 3)
 * @param timeLimitMs Optional time budget in milliseconds. If > 0, performs iterative deepening.
 * @returns Best Move object or null if game is over / no legal moves
 */
export function getBestMove(
  fen: string,
  depth = 3,
  timeLimitMs?: number
): Move | null {
  if (timeLimitMs && timeLimitMs > 0) {
    const res = getBestMoveIterative(fen, timeLimitMs, 20);
    return res.bestMove;
  }

  const game = new Chess(fen);
  if (game.isGameOver()) {
    return null;
  }

  const key = getPositionKey(fen);
  const rootEntry = transpositionTable.get(key);
  const moves = orderMoves(game.moves({ verbose: true }), rootEntry?.bestMove);

  if (moves.length === 0) {
    return null;
  }

  let bestMove: Move | null = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  // Cache root result in TT
  transpositionTable.set(key, {
    depth,
    score: bestScore,
    flag: 'exact',
    bestMove,
  });

  return bestMove;
}

/**
 * Helper search function that returns engine telemetry (nodes evaluated, eval, depth).
 *
 * @param fen FEN string representing the position
 * @param depth Search depth (default: 3)
 * @returns AISearchResult with bestMove and search metrics
 */
export function findBestMove(fen: string, depth = 3): AISearchResult {
  const game = new Chess(fen);
  if (game.isGameOver()) {
    return {
      bestMove: null,
      evaluation: evaluate(game),
      depth,
      nodes: 0,
    };
  }

  let nodeCount = 0;
  const onNode = () => {
    nodeCount++;
    return false;
  };

  const key = getPositionKey(fen);
  const rootEntry = transpositionTable.get(key);
  const moves = orderMoves(game.moves({ verbose: true }), rootEntry?.bestMove);

  if (moves.length === 0) {
    return {
      bestMove: null,
      evaluation: evaluate(game),
      depth,
      nodes: 0,
    };
  }

  let bestMove: Move | null = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    onNode();
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha, onNode);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  transpositionTable.set(key, {
    depth,
    score: bestScore,
    flag: 'exact',
    bestMove,
  });

  return {
    bestMove,
    evaluation: bestScore,
    depth,
    nodes: nodeCount,
  };
}

/**
 * Helper to convert piece single-letter symbol into human readable name.
 */
function getPieceName(symbol: string): string {
  switch (symbol.toLowerCase()) {
    case 'p': return 'pawn';
    case 'n': return 'knight';
    case 'b': return 'bishop';
    case 'r': return 'rook';
    case 'q': return 'queen';
    case 'k': return 'king';
    default: return 'piece';
  }
}

/**
 * Generates a human-understandable explanation for an AI move based on its tactical and positional characteristics.
 *
 * @param move The chosen Move object
 * @param gameBeforeMove The Chess instance right before the move was played
 * @returns Human-readable explanation string
 */
export function explainMove(move: Move, gameBeforeMove: Chess): string {
  const testGame = new Chess(gameBeforeMove.fen());
  try {
    testGame.move(move);
  } catch {
    // fallback if move throws
  }

  if (testGame.isCheckmate()) {
    return 'Delivered checkmate! Game over.';
  }

  if (testGame.inCheck()) {
    if (move.captured) {
      const victim = getPieceName(move.captured);
      const val = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES] ?? 0;
      return `Captured ${victim} (+${val}) with check!`;
    }
    return 'Delivered check to enemy King!';
  }

  if (move.captured) {
    const victim = getPieceName(move.captured);
    const val = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES] ?? 0;
    return `Captured ${victim} (+${val})`;
  }

  if (move.promotion) {
    return 'Promoted pawn to a new Queen!';
  }

  if (move.flags && (move.flags.includes('k') || move.flags.includes('q'))) {
    return 'Castled to secure King safety and activate rook.';
  }

  if (move.piece === 'n') {
    const toCol = move.to.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(move.to[1], 10);
    if (toCol >= 2 && toCol <= 5 && toRow >= 2 && toRow <= 5) {
      return 'Centralized Knight to an active central outpost.';
    }
    return 'Improved Knight positioning and mobility.';
  }

  if (move.piece === 'b') {
    return 'Activated Bishop onto an open diagonal.';
  }

  if (move.piece === 'r') {
    const toRow = parseInt(move.to[1], 10);
    if ((move.color === 'w' && toRow === 7) || (move.color === 'b' && toRow === 2)) {
      return 'Infiltrated Rook onto the powerful 7th rank!';
    }
    return 'Positioned Rook on an active open file.';
  }

  if (move.piece === 'p') {
    if (move.to === 'e4' || move.to === 'd4' || move.to === 'e5' || move.to === 'd5') {
      return 'Advanced central pawn to control critical center squares.';
    }
    return 'Pushed pawn to expand board control.';
  }

  if (move.piece === 'q') {
    return 'Repositioned Queen to coordinate tactical threats.';
  }

  if (move.piece === 'k') {
    return 'Shifted King to a safer square.';
  }

  return 'Developed position and improved piece coordination.';
}

/**
 * Extracts Principal Variation (PV) line from the Transposition Table.
 *
 * @param game Active Chess game
 * @param maxPlies Maximum moves to extract (default: 3)
 * @returns Array of SAN move strings representing the anticipated line
 */
export function extractPV(game: Chess, maxPlies = 3): string[] {
  const pv: string[] = [];
  const tempGame = new Chess(game.fen());

  for (let ply = 0; ply < maxPlies; ply++) {
    const key = getPositionKey(tempGame.fen());
    const entry = transpositionTable.get(key);
    if (!entry || !entry.bestMove) break;

    const move = entry.bestMove;
    try {
      const res = tempGame.move(move);
      if (!res) break;
      pv.push(res.san);
    } catch {
      break;
    }
  }

  return pv;
}

