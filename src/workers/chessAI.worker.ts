import { Chess, Move } from 'chess.js';
import { getBestMove, getBestMoveIterative, explainMove, extractPV } from '../lib/ai/chessAI';

/**
 * Dedicated Web Worker for running Chess AI search asynchronously without blocking the UI.
 *
 * Listens for messages with:
 * - { fen: string, depth?: number } -> fixed depth search
 * - { fen: string, timeLimitMs?: number, isExpert?: boolean } -> time-limited iterative deepening
 *
 * Posts { move, bestMove, depthReached, nodes, timeMs, score, reasoning, pv } back to the main thread.
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
    let move: Move | null = null;
    let depthReached = typeof depth === 'number' ? depth : 3;
    let nodes = 0;
    let timeMs = 0;
    let score = 0;

    if (isExpert || timeLimitMs) {
      const budget = typeof timeLimitMs === 'number' ? timeLimitMs : 2000;
      const result = getBestMoveIterative(fen, budget, 20);
      move = result.bestMove;
      depthReached = result.depthReached;
      nodes = result.nodes;
      timeMs = result.timeMs;
      score = result.score;
    } else {
      const t0 = Date.now();
      const numDepth = typeof depth === 'number' ? depth : 3;
      move = getBestMove(fen, numDepth);
      timeMs = Date.now() - t0;
      depthReached = numDepth;
    }

    let reasoning = 'Developed position.';
    let pv: string[] = [];

    if (move) {
      reasoning = explainMove(move, game);
      pv = extractPV(game, 3);
    }

    self.postMessage({
      move,
      bestMove: move,
      depthReached,
      score,
      nodes,
      timeMs,
      reasoning,
      pv,
    });
  } catch (err) {
    console.error('Chess AI worker execution error:', err);
    self.postMessage({
      move: null,
      bestMove: null,
      error: String(err),
    });
  }
};

export {};
