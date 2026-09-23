import { Chess, Move } from 'chess.js';
import {
  getBestMoveDetailed,
  getBestMoveIterativeDetailed,
  explainMove,
  extractPV,
  DetailedSearchResult,
} from '../lib/ai/chessAI';
import { getEvaluationBreakdown } from '../lib/ai/evaluation';

/**
 * Dedicated Web Worker for running Chess AI search asynchronously without blocking the UI.
 *
 * Listens for messages with:
 * - { fen: string, depth?: number } -> fixed depth search
 * - { fen: string, timeLimitMs?: number, isExpert?: boolean } -> time-limited iterative deepening
 *
 * Posts { move, bestMove, depthReached, nodes, timeMs, score, reasoning, pv, calculationDetails } back.
 */
self.onmessage = (e: MessageEvent) => {
  const data = e.data || {};
  const fen = data.fen || data.payload?.fen;
  const depth = data.depth || data.payload?.depth || 3;
  const timeLimitMs = data.timeLimitMs || data.payload?.timeLimitMs;
  const isExpert = data.isExpert || data.mode === 'expert' || depth === 'expert';

  if (!fen) {
    return;
  }

  try {
    const game = new Chess(fen);
    let detailedResult: DetailedSearchResult;

    if (isExpert || timeLimitMs) {
      const budget = typeof timeLimitMs === 'number' ? timeLimitMs : 2000;
      detailedResult = getBestMoveIterativeDetailed(fen, budget, 20);
    } else {
      const numDepth = typeof depth === 'number' ? depth : 3;
      detailedResult = getBestMoveDetailed(fen, numDepth);
    }

    const move: Move | null = detailedResult.bestMove;
    let reasoning = 'Developed position.';
    let pv: string[] = [];

    if (move) {
      reasoning = explainMove(move, game);
      pv = extractPV(game, 3);
    }

    // Compute nominal-only pruning efficiency: excludes qNodes to prevent distortion
    const legalMovesCount = game.moves().length;
    const nominalNodes = Math.max(1, detailedResult.stats.totalNodes - detailedResult.stats.qNodes);
    const estimatedFullTree = Math.pow(Math.max(1, legalMovesCount), detailedResult.depthReached);
    const pruningEfficiency = estimatedFullTree > 0
      ? Math.max(0, Math.min(99.9, Number(((1 - nominalNodes / estimatedFullTree) * 100).toFixed(1))))
      : 0;

    const evalBreakdown = getEvaluationBreakdown(game);

    const calculationDetails = {
      candidateMoves: detailedResult.candidateMoves,
      depthIterations: detailedResult.depthIterations,
      stats: detailedResult.stats,
      pruningEfficiency,
      evalBreakdown,
      estimatedFullTree,
      nominalNodes,
    };

    self.postMessage({
      move,
      bestMove: move,
      depthReached: detailedResult.depthReached,
      score: detailedResult.whiteScore,
      nodes: detailedResult.stats.totalNodes,
      timeMs: detailedResult.timeMs,
      reasoning,
      pv,
      calculationDetails,
      requestId: data.requestId,
    });
  } catch (err) {
    console.error('Chess AI worker execution error:', err);
    self.postMessage({
      move: null,
      bestMove: null,
      error: String(err),
      requestId: data.requestId,
    });
  }
};


export {};
