# Phase 3: Position Evaluation & Heuristics

## Milestone 1: Standalone Material-Only Evaluation Function

### 1. Overview
Implemented a standalone, testable, and robust material-only evaluation function in `src/lib/ai/evaluation.ts` for `chess.js` (`Chess` instance). This serves as the foundation for the AI engine's position scoring and minimax search.

---

### 2. Specification & Contract

- **File**: `src/lib/ai/evaluation.ts`
- **Piece Centipawn Values (`PIECE_VALUES`)**:
  - Pawn (`p`): `100`
  - Knight (`n`): `320`
  - Bishop (`b`): `330`
  - Rook (`r`): `500`
  - Queen (`q`): `900`
  - King (`k`): `20000`

- **Side-to-Move Perspective (`evaluate(game: Chess): number`)**:
  - **Checkmate**: Returns `-Infinity` if `game.isCheckmate()` (since the side whose turn it is has been checkmated).
  - **Draw**: Returns `0` if `game.isDraw()` (covers stalemate, 50-move rule, threefold repetition, and insufficient material).
  - **Material Calculation**:
    $$\text{material} = \sum (\text{White pieces}) - \sum (\text{Black pieces})$$
    $$\text{score} = \begin{cases} +\text{material}, & \text{if White to move} \\ -\text{material}, & \text{if Black to move} \end{cases}$$
    A positive score always indicates an advantage for whichever side moves next.

- **Helper Function**:
  - `evaluateBoard(fen: string): number`: Parses FEN into a `Chess` instance and invokes `evaluate(game)` for convenience.

---

### 3. Implementation Summary

#### `src/lib/ai/evaluation.ts`
```typescript
import { Chess, PieceSymbol } from 'chess.js';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return -Infinity;
  }

  if (game.isDraw()) {
    return 0;
  }

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

export function evaluateBoard(fen: string): number {
  const game = new Chess(fen);
  return evaluate(game);
}
```

---

### 4. Unit Testing & Verification

A dedicated unit test suite was implemented in `src/lib/ai/evaluation.test.ts`.

#### Test Cases Covered:
1. **Contract Check**: Verified `PIECE_VALUES` matches exact values (`p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000`).
2. **Equal Material (Starting Position)**: Evaluates to `0` with White to move.
3. **Material Advantage (White turn)**: White up a queen evaluates to `+900`.
4. **Perspective Flip (Black turn)**: White up a queen with Black to move evaluates to `-900`.
5. **Advantage for Black (Black turn)**: Black up a queen with Black to move evaluates to `+900`.
6. **Checkmate (Fool's Mate)**: White checkmated, White to move evaluates to `-Infinity`.
7. **Checkmate (Scholar's Mate)**: Black checkmated, Black to move evaluates to `-Infinity`.
8. **Draw (Stalemate)**: Queen & King vs King stalemate evaluates to `0`.
9. **Draw (Insufficient Material)**: King vs King evaluates to `0`.

#### Test Execution:
```bash
npm test
```
```text
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
```

---

### 5. Tooling & Configuration Updates
- Added `"test": "npx tsx src/lib/ai/evaluation.test.ts"` to `package.json` scripts.
- Configured `.eslintrc.json` to support `_`-prefixed unused variable patterns (`argsIgnorePattern`, `varsIgnorePattern`).
- Ran full validation:
  - `npx tsc --noEmit` — 0 TypeScript errors.
  - `npm run lint` — 0 ESLint warnings or errors.
  - `npm test` — 9/9 unit tests passing.
