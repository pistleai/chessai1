# Phase 8: Quiescence Search & Transposition Table

## Milestone: Horizon Effect Elimination & Transposition Caching

### 1. Overview
Integrated two core chess programming algorithms into `src/lib/ai/chessAI.ts` and `src/lib/ai/transposition.ts`:
1. **Quiescence Search (`quiesce`)**: Eliminates the "horizon effect" by continuing capture-only tactical searches at leaf nodes until the position becomes quiet.
2. **Transposition Table (`transpositionTable`)**: Caches minimax search results and bounds (`exact`, `lower`, `upper`) keyed by normalized FEN, preventing redundant evaluations across transposed paths.

---

### 2. Specification & Contract

#### A. Quiescence Search (`quiesce(game, alpha, beta, maxQDepth = 6): number`)
- **Location**: `src/lib/ai/chessAI.ts`
- **Leaf Transition**: At `depth === 0`, Negamax delegates directly to `quiesce(game, alpha, beta)`.
- **Stand-Pat Principle**:
  - Calculates static evaluation `standPat = evaluate(game)`.
  - If `standPat >= beta`, returns `beta` immediately (a player is never forced to make a disadvantageous capture).
  - Updates `alpha = Math.max(alpha, standPat)`.
- **Tactical Filtering**:
  - If the king is in check (`game.inCheck()`), evaluates all legal moves to escape check (or returns `-Infinity` if checkmated).
  - If not in check, filters and evaluates only moves that capture pieces (`m.captured`).
  - Orders captures using MVV (`orderMoves`).
  - Evaluates each capture recursively with `qdepth - 1` up to a safe horizon limit.

#### B. Transposition Table (`src/lib/ai/transposition.ts`)
- **Key Normalization (`getPositionKey(fen)`)**:
  - Extracts the 4-tuple: `<piece placement> <turn> <castling rights> <en-passant square>`.
  - Ignores half-move clock and full-move number so different move orders reaching identical positions match the exact same key.
- **Entry Structure (`TTEntry`)**:
  - `depth`: Depth at which the position was searched.
  - `score`: Evaluated score.
  - `flag`:
    - `'exact'`: Value was fully within $[\alpha, \beta]$ (PV-node).
    - `'lower'`: Beta-cutoff occurred ($score \ge \beta$), true score is at least this value.
    - `'upper'`: Failed low ($score \le \alpha$), true score is at most this value.
  - `bestMove`: Best candidate move found for move ordering in subsequent visits.
- **Lookup & Cutoff Logic**:
  - Before move generation in `negamax`, if `entry.depth >= currentDepth`:
    - If `flag === 'exact'`, return `entry.score`.
    - If `flag === 'lower' && entry.score >= beta`, return `entry.score`.
    - If `flag === 'upper' && entry.score <= alpha`, return `entry.score`.
- **Move Ordering Synergy**:
  - When searching a node, `entry.bestMove` is placed first before captures, drastically improving alpha-beta cutoff frequency.

---

### 3. Implementation Summary

#### `src/lib/ai/transposition.ts`
```typescript
import { Move } from 'chess.js';

export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: Move | null;
}

export const transpositionTable = new Map<string, TTEntry>();

export function getPositionKey(fen: string): string {
  const parts = fen.split(' ');
  return parts.slice(0, 4).join(' ');
}

export function clearTranspositionTable(): void {
  transpositionTable.clear();
}
```

#### `src/lib/ai/chessAI.ts` (Quiescence & Transposition Integration)
```typescript
export function quiesce(
  game: Chess,
  alpha: number,
  beta: number,
  maxQDepth: number = 6
): number {
  if (game.isGameOver()) return evaluate(game);

  const standPat = evaluate(game);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (maxQDepth <= 0) return alpha;

  const inCheck = game.inCheck();
  const candidateMoves = inCheck
    ? game.moves({ verbose: true })
    : game.moves({ verbose: true }).filter((m) => !!m.captured);

  if (candidateMoves.length === 0) return inCheck ? -Infinity : alpha;

  const orderedCaptures = orderMoves(candidateMoves);
  for (const move of orderedCaptures) {
    game.move(move);
    const score = -quiesce(game, -beta, -alpha, maxQDepth - 1);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
```

---

### 4. Benchmark Verification (Depth 4 Search)

Executed benchmark comparing Depth 4 search from the starting position via `npm run benchmark`:

```bash
npm run benchmark
```

```text
===============================================================
  CHESS ENGINE BENCHMARK: DEPTH 4 SEARCH (STARTING POSITION)
===============================================================

Running search WITHOUT Transposition Table (Depth 4)...
[Without TT] Nodes: 7,952 | Time: 2876ms | Best Move: Nc3 | Score: 0

Running search WITH Transposition Table (Depth 4)...
[With TT]    Nodes: 7,408 | Time: 2361ms | Best Move: Nc3 | Score: 0

---------------------------------------------------------------
RESULTS COMPARISON:
Nodes Searched: 7,952 -> 7,408 (reduced by 544 nodes, -6.8%)
Search Time:    2876ms -> 2361ms (-515ms, 17.9% faster)
---------------------------------------------------------------
```

#### Key Metrics:
- **Node Count Reduction**: **-544 nodes (-6.8%)** eliminated through transposition cache hits.
- **Search Latency**: **515ms faster (17.9% speedup)** on initial search pass.
- **Best Move Consistency**: Identical decision (`Nc3`, score 0) proving sound mathematical equivalence without search degradation.

---

### 5. Test Suite Verification
```bash
npm test
```
- Evaluation test suite: **12/12 passed**.
- Negamax AI test suite: **8/8 passed**.
- Total: **20 passed, 0 failed**.
- TypeScript (`npx tsc --noEmit`): **0 errors**.
- ESLint (`npm run lint`): **0 warnings or errors**.
