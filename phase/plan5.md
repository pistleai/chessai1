# Phase 5: Web Worker Integration

## Milestone: Non-Blocking Asynchronous AI Search

### 1. Overview
Integrated a dedicated Web Worker in `src/workers/chessAI.worker.ts` and connected it to `src/components/chess/ChessBoard.tsx`. This completely offloads the recursive Negamax alpha-beta search from the browser's main UI thread, ensuring zero frame drops or interface freezing during engine calculation.

---

### 2. Specification & Contract

- **Worker File**: `src/workers/chessAI.worker.ts`
  - Listens for messages containing `{ fen: string, depth?: number }`.
  - Invokes `getBestMove(fen, depth)` from `src/lib/ai/chessAI.ts`.
  - Posts back `{ move, bestMove }` on completion.

- **Component Integration**: `src/components/chess/ChessBoard.tsx`
  - Spawns Web Worker in `useEffect`:
    ```typescript
    const worker = new Worker(
      new URL("../../workers/chessAI.worker.ts", import.meta.url)
    );
    ```
  - Automatically terminates the worker on component unmount (`worker.terminate()`).
  - Upon human move completion, if `gameMode === "vs_ai"` and `game.turn() === "b"`, sends `{ fen: game.fen(), depth: aiDepth }` to the worker and sets `isAIThinking = true`.
  - Disables board interactions (`arePiecesDraggable={false}`, `cursor-wait`) and renders an animated `"AI Thinking..."` indicator badge while waiting for the worker.
  - On worker response (`worker.onmessage`), safely applies the move with `game.move(move)`, updates `fen`, move history, check/checkmate indicators, and re-enables human player control.

- **UI & UX Controls**:
  - **Game Mode Toggle**: Seamlessly switch between `vs AI Engine` (default) and `Pass & Play (Local)`.
  - **Depth Selector**: Selectable AI search depths (`D1`, `D2`, `D3`, `D4`), defaulting to `Depth 3 (Standard)`.
  - **Real-Time Turn Indicator**: Displays `"White's Turn (You)"` vs `"Black's Turn (AI)"` with active status pills.

---

### 3. Implementation Summary

#### `src/workers/chessAI.worker.ts`
```typescript
import { getBestMove } from '../lib/ai/chessAI';

self.onmessage = (e: MessageEvent) => {
  const data = e.data || {};
  const fen = data.fen || data.payload?.fen;
  const depth = data.depth || data.payload?.depth || 3;

  if (!fen) {
    return;
  }

  try {
    const move = getBestMove(fen, depth);
    self.postMessage({
      move,
      bestMove: move,
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
```

#### `src/components/chess/ChessBoard.tsx` (Worker Lifecycle & State Handlers)
```typescript
useEffect(() => {
  setMounted(true);

  const worker = new Worker(
    new URL("../../workers/chessAI.worker.ts", import.meta.url)
  );
  workerRef.current = worker;

  worker.onmessage = (e: MessageEvent) => {
    const move = e.data?.move || e.data?.bestMove;
    if (move && !chessRef.current.isGameOver()) {
      try {
        const appliedMove = chessRef.current.move(move);
        if (appliedMove) {
          setLastMove({ from: appliedMove.from as Square, to: appliedMove.to as Square });
          updateStateFromGame();
        }
      } catch (err) {
        console.error("Failed to apply worker move:", err);
      }
    }
    setIsAIThinking(false);
  };

  worker.onerror = (err) => {
    console.error("Chess AI Worker error:", err);
    setIsAIThinking(false);
  };

  return () => {
    worker.terminate();
    workerRef.current = null;
  };
}, [updateStateFromGame]);
```

---

### 4. Verification & Live Gameplay Test

#### 1. Unit Test Suites
```bash
npm test
```
- Evaluation test suite: **9/9 passed**.
- Negamax AI test suite: **8/8 passed**.
- Total: **17 passed, 0 failed**.

#### 2. Code Quality & Compilation
- `npx tsc --noEmit` — 0 TypeScript errors.
- `npm run lint` — 0 ESLint warnings or errors.
- `npm run build` — Clean production build with Web Worker compiled into separate bundle.

#### 3. Live Browser Verification
- Tested in browser via automated subagent at `http://localhost:3000/chess`.
- **Move 1**: White played `1. e4`.
  - Worker triggered asynchronously.
  - Thinking badge appeared without UI freeze.
  - Black AI responded with legal move: `1... Nc6`.
- **Move 2**: White played `2. e5`.
  - Black AI evaluated tactical capture and played `2... Nxe5`.
- Move history verified:
  ```text
  1. e4   Nc6
  2. e5   Nxe5
  ```
- **Recorded Browser Session**: Available at `file:///C:/Users/Vicky%20kumar/.gemini/antigravity-ide/brain/d8cc1950-0660-4bf7-97e9-764ceac1fac6/ai_gameplay_test_1790122518036.webp`.
