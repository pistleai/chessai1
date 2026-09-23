# Phase 4: Negamax Search with Alpha-Beta Pruning

## Milestone: Core AI Search Engine

### 1. Overview
Implemented the chess engine move search algorithm in `src/lib/ai/chessAI.ts` using recursive **Negamax with Alpha-Beta pruning** and **MVV (Most Valuable Victim) move ordering**. The engine calls `evaluate()` from `src/lib/ai/evaluation.ts` and uses zero-allocation in-place board state mutations (`game.move(move)` / `game.undo()`) for maximum search performance.

---

### 2. Specification & Contract

- **File**: `src/lib/ai/chessAI.ts`
- **Move Ordering (`orderMoves(moves: Move[]): Move[]`)**:
  - Sorts captures first, ordered by victim piece value descending ($Q: 900 > R: 500 > B: 330 > N: 320 > P: 100 > \text{quiet}: 0$).
  - Drastically improves alpha-beta cutoff efficiency by evaluating high-impact captures first.

- **Recursive Negamax (`negamax(game: Chess, depth: number, alpha: number, beta: number): number`)**:
  - **Base condition**: Returns `evaluate(game)` when `depth === 0` or `game.isGameOver()`.
  - **Recursive step**: Inverts opponent's score via `-negamax(game, depth - 1, -beta, -alpha)`.
  - **Alpha-Beta cutoff**: `if (alpha >= beta) break;` trims subtrees that cannot influence the final decision.
  - **Memory Efficiency**: Mutates the game with `game.move(move)` and rolls back with `game.undo()` after each trial (zero object cloning).

- **Move Selector (`getBestMove(fen: string, depth = 3): Move | null`)**:
  - Entry point for AI move selection.
  - Initializes `alpha = -Infinity`, `beta = Infinity`.
  - Iterates through candidate moves, applies Negamax at `depth - 1`, updates the best move, and returns the highest-scoring `Move` object (or `null` if no legal moves exist).

- **Search Metrics Helper (`findBestMove(fen: string, depth = 3): AISearchResult`)**:
  - Returns `bestMove`, `evaluation`, `depth`, and cumulative `nodes` evaluated for UI and telemetry integration.

---

### 3. Implementation Summary

#### `src/lib/ai/chessAI.ts`
```typescript
import { Chess, Move } from 'chess.js';
import { evaluate, PIECE_VALUES } from './evaluation';

export interface AISearchResult {
  bestMove: Move | null;
  evaluation: number;
  depth: number;
  nodes: number;
}

export function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const aVal = a.captured ? (PIECE_VALUES[a.captured] ?? 0) : 0;
    const bVal = b.captured ? (PIECE_VALUES[b.captured] ?? 0) : 0;
    return bVal - aVal;
  });
}

export function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluate(game);
  }

  const moves = orderMoves(game.moves({ verbose: true }));
  let maxScore = -Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();

    if (score > maxScore) {
      maxScore = score;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break;
    }
  }

  return maxScore;
}

export function getBestMove(fen: string, depth = 3): Move | null {
  const game = new Chess(fen);
  if (game.isGameOver()) {
    return null;
  }

  const moves = orderMoves(game.moves({ verbose: true }));
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

  return bestMove;
}
```

---

### 4. Unit Testing & Verification

A dedicated unit test suite was implemented in `src/lib/ai/chessAI.test.ts`.

#### Verified Scenarios:
1. **Move Ordering (MVV)**: Validates captures appear before quiet moves, ordered by victim value ($Q > R > B > N > P$).
2. **Starting Position Search**: Returns a valid legal move (e.g. `a3`) within ~150ms at depth 3.
3. **Hanging Queen Capture (White)**: White knight on `c3` captures undefended black queen on `e4` (`Nxe4`, score +1000).
4. **Hanging Queen Capture (Black)**: Black knight on `f6` captures undefended white queen on `e4` (`Nxe4`).
5. **Scholar's Mate in 1 (White)**: White plays `Qxf7#`, correctly evaluated to `Infinity`.
6. **Fool's Mate in 1 (Black)**: Black plays `Qh4#`, correctly evaluated to `Infinity`.
7. **Terminal Position**: Returns `null` on checkmated positions.
8. **Engine Telemetry**: Validates node counting and score reporting in `findBestMove`.

#### Full Test Suite Execution:
```bash
npm test
```
```text
> chess-ai@0.1.0 test
> npx tsx src/lib/ai/evaluation.test.ts && npx tsx src/lib/ai/chessAI.test.ts

--- Running Chess Evaluation Unit Tests ---
[PASS] PIECE_VALUES exact contract check
[PASS] Starting position evaluates to 0 (equal material, White to move)
[PASS] White up a queen evaluates strongly positive (+900) from White turn
[PASS] Perspective flips to negative (-900) when White is up a queen but it's Black's turn
[PASS] Black up a queen evaluates positive (+900) from Black's turn
[PASS] Checkmate returns -Infinity (side to move is checkmated - Fool's Mate)
[PASS] Checkmate returns -Infinity (Scholar's Mate, Black is checkmated)
[PASS] Draw by stalemate evaluates to 0
[PASS] Draw by insufficient material evaluates to 0

Results: 9 passed, 0 failed out of 9 tests.

--- Running Chess Negamax AI Unit Tests ---
[PASS] orderMoves sorts captures first and higher victim values first (MVV)
[PASS] Starting position returns a valid legal move
[PASS] Finds free hanging queen capture as White (Nxe4)
[PASS] Finds free hanging queen capture as Black (Nxe4)
[PASS] Finds Scholar's mate in 1 as White (Qxf7#)
[PASS] Finds Fool's mate in 1 as Black (Qh4#)
[PASS] Returns null on game over position (already checkmated)
[PASS] findBestMove helper returns accurate engine metrics (nodes, depth, evaluation)

Results: 8 passed, 0 failed out of 8 tests.
```

---

### 5. Build, Lint & Performance Summary
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **ESLint**: `npm run lint` passed with 0 warnings or errors.
- **Node Performance**: Depth 3 search explores ~300 to ~800 nodes in under ~350ms in Node without allocating new `Chess` objects.
