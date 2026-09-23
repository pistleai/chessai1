# Chess AI — Project Plan & Architecture

## Overview
A Next.js 14 web application featuring a modern Chess interface powered by `react-chessboard`, `chess.js`, and an AI chess engine executing minimax search with alpha-beta pruning and transposition tables inside a Web Worker.

---

## Installed Dependency Versions (Phase 1 Confirmation)
- **Next.js**: `14.2.35`
- **React / React-DOM**: `18.3.1`
- **chess.js**: `1.4.0`
- **react-chessboard**: `4.7.3`

### Note on `react-chessboard` API (v3 vs v4 vs v5):
- `react-chessboard` version **4.7.3** is installed.
- `react-chessboard` v5 requires React 19 (`peer react: ^19.0.0`), whereas Next.js 14 uses React 18.
- Between v3 and v4:
  - Props use `position` (FEN string).
  - Move drop callback is `onPieceDrop?: (sourceSquare: Square, targetSquare: Square, piece: Piece) => boolean`. Returning `false` rejects/snaps back illegal moves.
  - Sizing is managed via `boardWidth` or flexible container styling.
  - Board orientation is controlled via `boardOrientation?: 'white' | 'black'`.
  - Custom square styling via `customSquareStyles`.

---

## Directory Structure
```
src/
├── app/
│   ├── chess/
│   │   └── page.tsx              # Main /chess route displaying the board, eval, and stats
│   ├── layout.tsx                # App layout & font configurations
│   ├── globals.css               # Tailwind CSS base styles
│   └── page.tsx                  # Home landing page
├── components/
│   └── chess/
│       ├── ChessBoard.tsx        # react-chessboard wrapper with drag & drop handling
│       ├── EvalBar.tsx           # Vertical real-time evaluation advantage meter
│       └── AIStats.tsx           # Search depth, nodes evaluated, time, and PV stats
├── lib/
│   └── ai/
│       ├── chessAI.ts            # Minimax & alpha-beta search coordinator
│       ├── evaluation.ts         # Material & Piece-Square Table (PST) scoring
│       └── transposition.ts      # Transposition table (TT) & Zobrist hashing
└── workers/
    └── chessAI.worker.ts         # Dedicated Web Worker for off-main-thread search
```

---

## Phases Roadmap
1. **Phase 1: Project Setup & Scaffolding** *(Completed)*
   - Scaffolding Next.js 14 App Router with TypeScript & Tailwind CSS.
   - Install `chess.js@1.4.0` & `react-chessboard@4.7.3`.
   - Setup placeholder files and verify clean compile.
2. **Phase 2: Interactive Chessboard & Game State** *(Completed)*
   - Connected `chess.js` ref and `fen` reactive state to `react-chessboard`.
   - Added legal move validation with `chess.js` error handling (invalid moves rejected safely).
   - Implemented drag-and-drop (`onPieceDrop`) and click-to-move (`onSquareClick`) with legal destination indicators.
   - Implemented turn switching, king check glow, checkmate, stalemate, and draw detection.
   - Built real-time SAN move history and "Reset Game" functionality.
   - Fully verified in browser with live gameplay and checkmate test.
3. **Phase 3 & Phase 7: Position Evaluation & Piece-Square Tables (PST)** *(Completed)*
   - Implemented piece values, position heuristics, and standalone evaluation function (documented in `phase/plan3.md`).
   - Implemented 8x8 Piece-Square Tables for all 6 pieces, middlegame vs endgame king evaluation, and central piece bonuses (documented in `phase/plan7.md`).
   - Connect real-time evaluation bar.
4. **Phase 4 & Phase 8: AI Engine Search (Negamax + Quiescence + Transposition Table)** *(Completed)*
   - Move ordering (MVV) and depth-limited Negamax search with alpha-beta pruning (documented in `phase/plan4.md`).
   - Quiescence search to eliminate the horizon effect (documented in `phase/plan8.md`).
   - Transposition table with bounds caching (`exact`, `lower`, `upper`) yielding a verified 6.8% node reduction and 17.9% speedup at Depth 4 (documented in `phase/plan8.md`).
5. **Phase 5: Web Worker Offloading & Performance Optimization** *(Completed)*
   - Run AI engine in `chessAI.worker.ts` so the UI remains fluid at 60 FPS (documented in `phase/plan5.md`).
   - Non-blocking search, thinking state indicator, and interactive depth selection.
6. **Phase 6 & Phase 9: Polish, Difficulty Levels & Iterative Deepening** *(Completed)*
   - Difficulty selection (`D1`, `D2`, `D3`, `D4`, and `EXP` / Expert mode).
   - Time-budgeted Iterative Deepening search (~2000ms) with move ordering recycling across depths (documented in `phase/plan9.md`).
   - Sound effects, move history, and search telemetry display.
7. **Phase 10: Visualization, Explainability & Deployment** *(Completed)*
   - Dynamic White-perspective `EvalBar` showing advantage meter and centipawn/mate score.
   - Comprehensive `AIStats` telemetry displaying depth reached, nodes evaluated, search time, and nodes per second.
   - Heuristic move reasoning engine (`explainMove`) explaining captures, checks, castling, and outposts.
   - Principal Variation (`extractPV`) tracing the 2-3 ply anticipated line from Transposition Table.
   - Clean Next.js 14 production bundle (`npm run build`) with Web Worker bundling verified (documented in `phase/plan10.md`).

