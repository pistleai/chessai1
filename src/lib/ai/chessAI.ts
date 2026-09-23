import { Chess, Move, PieceSymbol } from 'chess.js';
import {
  evaluate,
  PIECE_VALUES,
  PST,
  KING_ENDGAME_TABLE,
  isEndgame,
  evaluateWhitePerspective,
} from './evaluation';
import {
  transpositionTable,
  getPositionKey,
  TTFlag,
} from './transposition';

export interface SearchStats {
  totalNodes: number;
  classicCutoffs: number;
  ttCutoffs: number;
  quiescenceCutoffs: number;
  qNodes: number;
  // Forward-compatibility hooks for Phase 12 & 13
  nullMoveCutoffs: number;
  lmrResearches: number;
}

export function createSearchStats(): SearchStats {
  return {
    totalNodes: 0,
    classicCutoffs: 0,
    ttCutoffs: 0,
    quiescenceCutoffs: 0,
    qNodes: 0,
    nullMoveCutoffs: 0,
    lmrResearches: 0,
  };
}

export interface CandidateMoveEval {
  san: string;
  from: string;
  to: string;
  whiteScore: number;        // ALWAYS White perspective for display
  nodes: number;
  isBest: boolean;
  rationale: string;         // Delta-derived rationale
  scoreDelta?: number;       // Difference from best move
}

export interface DepthIterationInfo {
  depth: number;
  bestMoveSan: string;
  whiteScore: number;
  timeMs: number;
  nodes: number;             // Isolated delta for this depth
}

export interface DetailedSearchResult {
  bestMove: Move | null;
  score: number;
  whiteScore: number;
  depthReached: number;
  stats: SearchStats;
  timeMs: number;
  candidateMoves: CandidateMoveEval[];
  depthIterations: DepthIterationInfo[];
}

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
 */
export function quiesce(
  game: Chess,
  alpha: number,
  beta: number,
  onNode?: () => boolean,
  maxQDepth: number = 6,
  stats?: SearchStats
): number {
  if (stats) {
    stats.totalNodes++;
    stats.qNodes++;
  }
  if (onNode && onNode()) return 0;
  if (game.isGameOver()) return evaluate(game);

  const standPat = evaluate(game);

  if (standPat >= beta) {
    if (stats) stats.quiescenceCutoffs++;
    return beta;
  }
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
    const score = -quiesce(game, -beta, -alpha, onNode, maxQDepth - 1, stats);
    game.undo();

    if (onNode && onNode()) return 0;

    if (score >= beta) {
      if (stats) stats.quiescenceCutoffs++;
      return beta;
    }
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * Recursive Negamax search with Alpha-Beta pruning, Transposition Table lookup,
 * and time-checking capability.
 */
export function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  onNode?: () => boolean,
  stats?: SearchStats
): number {
  if (stats) stats.totalNodes++;
  if (onNode && onNode()) return 0;
  if (game.isGameOver()) return evaluate(game);
  if (depth === 0) return quiesce(game, alpha, beta, onNode, 6, stats);

  // Transposition Table lookup
  const key = getPositionKey(game.fen());
  const entry = transpositionTable.get(key);

  if (entry && entry.depth >= depth) {
    if (entry.flag === 'exact') {
      if (stats) stats.ttCutoffs++;
      return entry.score;
    }
    if (entry.flag === 'lower' && entry.score >= beta) {
      if (stats) stats.ttCutoffs++;
      return entry.score;
    }
    if (entry.flag === 'upper' && entry.score <= alpha) {
      if (stats) stats.ttCutoffs++;
      return entry.score;
    }
  }

  const origAlpha = alpha;
  const moves = orderMoves(game.moves({ verbose: true }), entry?.bestMove);
  let maxScore = -Infinity;
  let bestMoveForNode: Move | null = null;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha, onNode, stats);
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
      if (stats) stats.classicCutoffs++;
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
 * Helper to get PST value for a piece on a square.
 */
export function getSquarePST(
  pieceType: PieceSymbol,
  color: 'w' | 'b',
  square: string,
  isEndgamePos: boolean
): number {
  const col = square.charCodeAt(0) - 97;
  const row = 8 - parseInt(square[1], 10);
  if (col < 0 || col > 7 || row < 0 || row > 7) return 0;

  if (pieceType === 'k' && isEndgamePos) {
    return color === 'w' ? KING_ENDGAME_TABLE[row][col] : KING_ENDGAME_TABLE[7 - row][col];
  }
  const table = PST[pieceType];
  if (!table || !table[row]) return 0;
  return color === 'w' ? table[row][col] : table[7 - row][col];
}

/**
 * Derives truthful, delta-derived rationale without canned phrase banks.
 * Priority order:
 * 1. Checkmate
 * 2. Checks
 * 3. Captures
 * 4. Promotions
 * 5. Castling
 * 6. Central Space Occupation (e4/d4/e5/d5)
 * 7. Positional PST Delta
 * 8. Fallback
 */
export function deriveMoveRationale(move: Move, gameBeforeMove: Chess): string {
  const testGame = new Chess(gameBeforeMove.fen());
  try {
    testGame.move(move);
  } catch {
    // fallback
  }

  // 1. Checkmate
  if (testGame.isCheckmate()) {
    return 'Delivers checkmate! Game over.';
  }

  // 2. Checks
  if (testGame.inCheck()) {
    if (move.captured) {
      const victim = getPieceName(move.captured);
      const val = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES] ?? 0;
      return `Captures ${victim} (+${val}) with check!`;
    }
    return 'Delivers check to enemy King';
  }

  // 3. Captures
  if (move.captured) {
    const victim = getPieceName(move.captured);
    const val = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES] ?? 0;
    return `Captures ${victim} (+${val})`;
  }

  // 4. Promotions
  if (move.promotion) {
    return 'Promotes pawn to Queen';
  }

  // 5. Castling
  if (move.flags && (move.flags.includes('k') || move.flags.includes('q'))) {
    return 'Castles for King safety and Rook activation';
  }

  // Positional PST deltas
  const isEndgamePos = isEndgame(gameBeforeMove);
  const pstFrom = getSquarePST(move.piece, move.color, move.from, isEndgamePos);
  const pstTo = getSquarePST(move.piece, move.color, move.to, isEndgamePos);
  const pstDelta = pstTo - pstFrom;

  // 6. Central Space Occupation (placed before generic PST delta to eliminate dead code)
  const centralSquares = ['e4', 'd4', 'e5', 'd5'];
  if (centralSquares.includes(move.to)) {
    const sign = pstDelta >= 0 ? `+${pstDelta}` : `${pstDelta}`;
    return `Claims critical central square ${move.to.toUpperCase()} (${sign} activity)`;
  }

  // 7. Positional PST Delta
  if (pstDelta >= 10) {
    return `Improves piece activity (+${pstDelta})`;
  }
  if (pstDelta <= -10) {
    return `Retreats to passive square (${pstDelta})`;
  }

  // 8. Fallback
  if (move.piece === 'p') {
    return 'Advances pawn for board space';
  }
  return `Develops ${getPieceName(move.piece)} and improves piece coordination`;
}

/**
 * Detailed fixed-depth search that collects full candidate move evaluations,
 * search stats, and White-perspective scores.
 */
export function getBestMoveDetailed(fen: string, depth = 3): DetailedSearchResult {
  const game = new Chess(fen);
  const stats = createSearchStats();
  const startTime = Date.now();

  if (game.isGameOver()) {
    const score = evaluate(game);
    const whiteScore = evaluateWhitePerspective(game) / 100;
    return {
      bestMove: null,
      score,
      whiteScore,
      depthReached: 0,
      stats,
      timeMs: 0,
      candidateMoves: [],
      depthIterations: [],
    };
  }

  const key = getPositionKey(fen);
  const rootEntry = transpositionTable.get(key);
  const moves = orderMoves(game.moves({ verbose: true }), rootEntry?.bestMove);

  if (moves.length === 0) {
    const score = evaluate(game);
    const whiteScore = evaluateWhitePerspective(game) / 100;
    return {
      bestMove: null,
      score,
      whiteScore,
      depthReached: 0,
      stats,
      timeMs: 0,
      candidateMoves: [],
      depthIterations: [],
    };
  }

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  const candidateEvals: { move: Move; score: number; whiteScore: number; nodes: number }[] = [];

  for (const move of moves) {
    const candNodesBefore = stats.totalNodes;
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha, undefined, stats);
    game.undo();
    const candNodes = stats.totalNodes - candNodesBefore;

    // Convert to White perspective in pawns
    const whiteScore = (game.turn() === 'w' ? score : -score) / 100;
    candidateEvals.push({ move, score, whiteScore, nodes: candNodes });

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

  // Sort candidate moves so the chosen best move is first, followed by descending move quality
  candidateEvals.sort((a, b) => b.score - a.score);

  const bestCandScore = candidateEvals[0].whiteScore;
  const candidateMoves: CandidateMoveEval[] = candidateEvals.map((cand, idx) => {
    const isBest = idx === 0;
    const scoreDelta = isBest
      ? 0
      : Number((cand.whiteScore - bestCandScore).toFixed(2));
    const rationale = deriveMoveRationale(cand.move, game);

    return {
      san: cand.move.san,
      from: cand.move.from,
      to: cand.move.to,
      whiteScore: cand.whiteScore,
      nodes: cand.nodes,
      isBest,
      rationale,
      scoreDelta,
    };
  });

  const whiteScore = (game.turn() === 'w' ? bestScore : -bestScore) / 100;
  const timeMs = Date.now() - startTime;

  const depthIterations: DepthIterationInfo[] = [
    {
      depth,
      bestMoveSan: bestMove.san,
      whiteScore,
      timeMs,
      nodes: stats.totalNodes,
    },
  ];

  return {
    bestMove,
    score: bestScore,
    whiteScore,
    depthReached: depth,
    stats,
    timeMs,
    candidateMoves,
    depthIterations,
  };
}

/**
 * Detailed Iterative Deepening search with strict time budget,
 * per-depth isolated node counts, and candidate move collection.
 */
export function getBestMoveIterativeDetailed(
  fen: string,
  timeLimitMs: number = 2000,
  maxDepth: number = 20
): DetailedSearchResult {
  const game = new Chess(fen);
  const stats = createSearchStats();
  const startTime = Date.now();
  const deadline = startTime + timeLimitMs;

  if (game.isGameOver()) {
    const score = evaluate(game);
    const whiteScore = evaluateWhitePerspective(game) / 100;
    return {
      bestMove: null,
      score,
      whiteScore,
      depthReached: 0,
      stats,
      timeMs: 0,
      candidateMoves: [],
      depthIterations: [],
    };
  }

  const legalMoves = orderMoves(game.moves({ verbose: true }));
  if (legalMoves.length === 0) {
    const score = evaluate(game);
    const whiteScore = evaluateWhitePerspective(game) / 100;
    return {
      bestMove: null,
      score,
      whiteScore,
      depthReached: 0,
      stats,
      timeMs: 0,
      candidateMoves: [],
      depthIterations: [],
    };
  }

  let bestOverallMove: Move = legalMoves[0];
  let bestOverallScore = -Infinity;
  let completedDepth = 0;
  let isTimeUp = false;

  const depthIterations: DepthIterationInfo[] = [];
  let latestCandidateEvals: { move: Move; score: number; whiteScore: number; nodes: number }[] = [];

  const checkTime = (): boolean => {
    if ((stats.totalNodes & 1023) === 0) {
      if (Date.now() >= deadline) {
        isTimeUp = true;
      }
    }
    return isTimeUp;
  };

  for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
    if (Date.now() >= deadline) break;

    // Snapshot stats before starting this depth to isolate per-depth node count
    const nodesBeforeDepth = stats.totalNodes;

    // FORWARD COMPATIBILITY NOTE (Phase 14 Aspiration Windows):
    // If aspiration window re-search triggers on fail-high / fail-low, reset candidateMoves list here.
    const iterationCandidates: { move: Move; score: number; whiteScore: number; nodes: number }[] = [];
    let iterationBestMove: Move = bestOverallMove;
    let iterationBestScore = -Infinity;
    let iterationAlpha = -Infinity;
    const iterationBeta = Infinity;

    const currentMoves = orderMoves(legalMoves, bestOverallMove);
    let iterationCompleted = true;

    for (const move of currentMoves) {
      if (checkTime()) {
        iterationCompleted = false;
        break;
      }

      const moveNodesBefore = stats.totalNodes;
      game.move(move);
      const score = -negamax(
        game,
        currentDepth - 1,
        -iterationBeta,
        -iterationAlpha,
        checkTime,
        stats
      );
      game.undo();
      const moveNodes = stats.totalNodes - moveNodesBefore;

      if (isTimeUp) {
        iterationCompleted = false;
        break;
      }

      const whiteScore = (game.turn() === 'w' ? score : -score) / 100;
      iterationCandidates.push({ move, score, whiteScore, nodes: moveNodes });

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
      latestCandidateEvals = iterationCandidates;

      const depthNodes = stats.totalNodes - nodesBeforeDepth;
      const iterWhiteScore = (game.turn() === 'w' ? iterationBestScore : -iterationBestScore) / 100;

      depthIterations.push({
        depth: currentDepth,
        bestMoveSan: iterationBestMove.san,
        whiteScore: iterWhiteScore,
        timeMs: Date.now() - startTime,
        nodes: depthNodes,
      });

      if (bestOverallScore === Infinity || bestOverallScore === -Infinity) {
        break;
      }
    } else {
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

  // Sort candidate moves so the chosen best move is first
  latestCandidateEvals.sort((a, b) => b.score - a.score);
  const bestCandScore = latestCandidateEvals.length > 0 ? latestCandidateEvals[0].whiteScore : 0;

  const candidateMoves: CandidateMoveEval[] = latestCandidateEvals.map((cand, idx) => {
    const isBest = idx === 0;
    const scoreDelta = isBest
      ? 0
      : Number((cand.whiteScore - bestCandScore).toFixed(2));
    const rationale = deriveMoveRationale(cand.move, game);

    return {
      san: cand.move.san,
      from: cand.move.from,
      to: cand.move.to,
      whiteScore: cand.whiteScore,
      nodes: cand.nodes,
      isBest,
      rationale,
      scoreDelta,
    };
  });

  const finalWhiteScore = (game.turn() === 'w' ? bestOverallScore : -bestOverallScore) / 100;

  return {
    bestMove: bestOverallMove,
    score: bestOverallScore,
    whiteScore: finalWhiteScore,
    depthReached: completedDepth,
    stats,
    timeMs: Date.now() - startTime,
    candidateMoves,
    depthIterations,
  };
}

/**
 * Backward-compatible entry point for iterative deepening.
 */
export function getBestMoveIterative(
  fen: string,
  timeLimitMs: number = 2000,
  maxDepth: number = 20
): IterativeSearchResult {
  const result = getBestMoveIterativeDetailed(fen, timeLimitMs, maxDepth);
  return {
    bestMove: result.bestMove,
    score: result.score,
    depthReached: result.depthReached,
    nodes: result.stats.totalNodes,
    timeMs: result.timeMs,
  };
}

/**
 * Backward-compatible entry point for AI move selection.
 */
export function getBestMove(
  fen: string,
  depth = 3,
  timeLimitMs?: number
): Move | null {
  if (timeLimitMs && timeLimitMs > 0) {
    const res = getBestMoveIterativeDetailed(fen, timeLimitMs, 20);
    return res.bestMove;
  }
  const res = getBestMoveDetailed(fen, depth);
  return res.bestMove;
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

