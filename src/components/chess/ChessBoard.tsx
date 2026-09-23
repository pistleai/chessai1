"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import EvalBar from "./EvalBar";
import AIStats from "./AIStats";
import { evaluateWhitePerspective } from "@/lib/ai/evaluation";

export interface GameStatus {
  isOver: boolean;
  message: string;
  type: "in_progress" | "checkmate" | "stalemate" | "draw";
  winner?: "white" | "black" | "draw";
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | "expert";

export default function ChessBoard() {
  const [mounted, setMounted] = useState(false);
  const chessRef = useRef(new Chess());
  const workerRef = useRef<Worker | null>(null);

  const [fen, setFen] = useState(chessRef.current.fen());
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [inCheck, setInCheck] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);

  // Real-time evaluation from White's perspective (+ = White advantage)
  const [evaluation, setEvaluation] = useState<number>(0);

  // AI & Game Mode State
  const [gameMode, setGameMode] = useState<"vs_ai" | "pvp">("vs_ai");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(3);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiTelemetry, setAiTelemetry] = useState<{
    depth?: number;
    nodesEvaluated?: number;
    searchTimeMs?: number;
    reasoning?: string;
    pv?: string[];
  }>({});

  const [gameStatus, setGameStatus] = useState<GameStatus>({
    isOver: false,
    message: "White to move",
    type: "in_progress",
  });

  const updateStateFromGame = useCallback(() => {
    const game = chessRef.current;
    setFen(game.fen());
    setTurn(game.turn());
    setInCheck(game.inCheck());
    setHistory(game.history());
    setSelectedSquare(null);
    setPossibleMoves([]);
    setEvaluation(evaluateWhitePerspective(game));

    if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "black" : "white";
      setGameStatus({
        isOver: true,
        type: "checkmate",
        winner,
        message: `Checkmate! ${winner === "white" ? "White" : "Black"} wins!`,
      });
    } else if (game.isStalemate()) {
      setGameStatus({
        isOver: true,
        type: "stalemate",
        winner: "draw",
        message: "Draw by Stalemate!",
      });
    } else if (game.isThreefoldRepetition()) {
      setGameStatus({
        isOver: true,
        type: "draw",
        winner: "draw",
        message: "Draw by Threefold Repetition!",
      });
    } else if (game.isInsufficientMaterial()) {
      setGameStatus({
        isOver: true,
        type: "draw",
        winner: "draw",
        message: "Draw by Insufficient Material!",
      });
    } else if (game.isDraw()) {
      setGameStatus({
        isOver: true,
        type: "draw",
        winner: "draw",
        message: "Draw (50-move rule)!",
      });
    } else {
      setGameStatus({
        isOver: false,
        type: "in_progress",
        message: `${game.turn() === "w" ? "White" : "Black"} to move`,
      });
    }
  }, []);

  // Web Worker setup & lifecycle
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
            setAiTelemetry({
              depth: e.data.depthReached,
              nodesEvaluated: e.data.nodes,
              searchTimeMs: e.data.timeMs,
              reasoning: e.data.reasoning,
              pv: e.data.pv,
            });
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

  // Execute move safely in chess.js
  const makeAMove = (from: Square, to: Square): boolean => {
    const game = chessRef.current;
    if (game.isGameOver() || isAIThinking) {
      return false;
    }

    if (gameMode === "vs_ai" && game.turn() !== "w") {
      return false;
    }

    try {
      const move = game.move({
        from,
        to,
        promotion: "q",
      });

      if (!move) {
        return false;
      }

      setLastMove({ from, to });
      updateStateFromGame();

      // If playing vs AI and now it's Black's turn, trigger worker
      if (gameMode === "vs_ai" && game.turn() === "b" && !game.isGameOver()) {
        setIsAIThinking(true);
        if (difficulty === "expert") {
          workerRef.current?.postMessage({
            fen: game.fen(),
            isExpert: true,
            timeLimitMs: 2000,
          });
        } else {
          workerRef.current?.postMessage({
            fen: game.fen(),
            depth: difficulty,
          });
        }
      }

      return true;
    } catch {
      return false;
    }
  };

  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (isAIThinking) return false;
    if (gameMode === "vs_ai" && chessRef.current.turn() !== "w") return false;
    return makeAMove(sourceSquare, targetSquare);
  };

  const onSquareClick = (square: Square) => {
    const game = chessRef.current;
    if (game.isGameOver() || isAIThinking) return;
    if (gameMode === "vs_ai" && game.turn() !== "w") return;

    if (!selectedSquare) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const legalMoves = game
          .moves({ square, verbose: true })
          .map((m) => m.to as Square);
        setPossibleMoves(legalMoves);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    const clickedPiece = game.get(square);
    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);
      const legalMoves = game
        .moves({ square, verbose: true })
        .map((m) => m.to as Square);
      setPossibleMoves(legalMoves);
      return;
    }

    const success = makeAMove(selectedSquare, square);
    if (!success) {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const resetGame = () => {
    chessRef.current.reset();
    setLastMove(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setIsAIThinking(false);
    setAiTelemetry({});
    updateStateFromGame();
  };

  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (lastMove) {
    customSquareStyles[lastMove.from] = {
      backgroundColor: "rgba(250, 204, 21, 0.3)",
    };
    customSquareStyles[lastMove.to] = {
      backgroundColor: "rgba(250, 204, 21, 0.4)",
    };
  }

  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: "rgba(59, 130, 246, 0.5)",
      boxShadow: "inset 0 0 8px rgba(37, 99, 235, 0.8)",
    };
  }

  possibleMoves.forEach((sq) => {
    const hasPiece = !!chessRef.current.get(sq);
    customSquareStyles[sq] = {
      background: hasPiece
        ? "radial-gradient(circle, rgba(239, 68, 68, 0.4) 65%, transparent 70%)"
        : "radial-gradient(circle, rgba(59, 130, 246, 0.5) 25%, transparent 26%)",
      borderRadius: "4px",
      cursor: "pointer",
    };
  });

  if (inCheck) {
    const board = chessRef.current.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === "k" && piece.color === turn) {
          customSquareStyles[piece.square] = {
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            boxShadow: "inset 0 0 14px rgba(220, 38, 38, 1)",
          };
        }
      }
    }
  }

  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  if (!mounted) {
    return (
      <div className="w-full max-w-[620px] aspect-square rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center animate-pulse shadow-2xl">
        <span className="text-slate-500 font-medium">Loading Chessboard...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl flex flex-col xl:flex-row items-center xl:items-start justify-center gap-6">
      {/* Chessboard + EvalBar Column */}
      <div className="flex flex-col items-center gap-3">
        {/* Turn & Status Header */}
        <div className="w-full max-w-[600px] flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div
              id="turn-indicator"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-sm"
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                  turn === "w"
                    ? "bg-amber-100 border-amber-300 shadow-[0_0_8px_rgba(254,243,199,0.6)]"
                    : "bg-slate-900 border-slate-600 shadow-[0_0_8px_rgba(30,41,59,0.8)]"
                }`}
              />
              <span className="text-xs font-semibold text-slate-200">
                {turn === "w"
                  ? "White's Turn (You)"
                  : gameMode === "vs_ai"
                  ? "Black's Turn (AI)"
                  : "Black's Turn"}
              </span>
            </div>

            {/* AI Thinking Indicator */}
            {isAIThinking && (
              <div
                id="ai-thinking-badge"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950/80 border border-violet-700/60 text-violet-300 text-xs font-semibold animate-pulse shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                <span>
                  {difficulty === "expert"
                    ? "AI Thinking (Expert ~2s)..."
                    : `AI Thinking (Depth ${difficulty})...`}
                </span>
              </div>
            )}

            {inCheck && !gameStatus.isOver && (
              <span
                id="check-indicator"
                className="px-2.5 py-1 text-xs font-bold bg-red-950/80 text-red-400 border border-red-700/60 rounded-full animate-pulse"
              >
                CHECK!
              </span>
            )}
          </div>

          <button
            id="reset-game-btn"
            onClick={resetGame}
            className="px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition duration-150 active:scale-95 shadow-sm"
          >
            Reset Game
          </button>
        </div>

        {gameStatus.isOver && (
          <div
            id="game-status-banner"
            className={`w-full max-w-[600px] p-3 rounded-xl border text-center font-semibold text-sm shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
              gameStatus.type === "checkmate"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                : "bg-blue-500/10 border-blue-500/40 text-blue-300"
            }`}
          >
            <span>{gameStatus.message}</span>
          </div>
        )}

        {/* Board & EvalBar Container */}
        <div className="flex items-center gap-3">
          {/* Vertical Real-time EvalBar */}
          <EvalBar
            evaluation={evaluation}
            isCheckmate={gameStatus.type === "checkmate"}
          />

          {/* Chessboard Container */}
          <div
            id="chessboard-wrapper"
            className={`w-[340px] sm:w-[440px] md:w-[560px] aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl p-2 transition-opacity ${
              isAIThinking ? "opacity-95 cursor-wait" : ""
            }`}
          >
            <Chessboard
              id="main-chessboard"
              position={fen}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              arePiecesDraggable={!isAIThinking && !gameStatus.isOver}
              isDraggablePiece={({ piece }) => {
                if (isAIThinking || gameStatus.isOver) return false;
                if (gameMode === "vs_ai") {
                  return piece.startsWith("w");
                }
                return piece.startsWith(turn);
              }}
              autoPromoteToQueen={true}
              boardOrientation="white"
              animationDuration={200}
              customBoardStyle={{
                borderRadius: "12px",
              }}
              customDarkSquareStyle={{
                backgroundColor: "#334155",
              }}
              customLightSquareStyle={{
                backgroundColor: "#94a3b8",
              }}
              customSquareStyles={customSquareStyles}
            />
          </div>
        </div>
      </div>

      {/* Side Info Panel: AI Settings + AIStats + Move History */}
      <div className="w-full max-w-[600px] xl:w-80 flex flex-col gap-3">
        {/* Game Mode & AI Settings Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Game Mode
            </h2>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              Web Worker
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setGameMode("vs_ai");
                resetGame();
              }}
              className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition ${
                gameMode === "vs_ai"
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm"
                  : "bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              vs AI Engine
            </button>
            <button
              onClick={() => {
                setGameMode("pvp");
                resetGame();
              }}
              className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition ${
                gameMode === "pvp"
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm"
                  : "bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              Pass & Play
            </button>
          </div>

          {/* AI Difficulty Selector */}
          {gameMode === "vs_ai" && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">AI Strength</span>
                <span className="text-amber-300 font-mono font-semibold">
                  {difficulty === "expert"
                    ? "Expert (2s Iterative)"
                    : `Depth ${difficulty}`}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d as DifficultyLevel)}
                    className={`py-1 rounded text-xs font-mono font-medium border transition ${
                      difficulty === d
                        ? "bg-slate-700 border-amber-400/60 text-amber-300"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    D{d}
                  </button>
                ))}
                <button
                  onClick={() => setDifficulty("expert")}
                  className={`py-1 rounded text-[11px] font-semibold tracking-tight border transition ${
                    difficulty === "expert"
                      ? "bg-violet-600/30 border-violet-400 text-violet-200 shadow-sm"
                      : "bg-slate-800/50 border-slate-700 text-violet-400 hover:bg-violet-950/40 hover:text-violet-200"
                  }`}
                >
                  EXP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Engine Telemetry Card (Live Search Stats + Reasoning + PV) */}
        {gameMode === "vs_ai" && (
          <AIStats
            depth={aiTelemetry.depth}
            nodesEvaluated={aiTelemetry.nodesEvaluated}
            searchTimeMs={aiTelemetry.searchTimeMs}
            score={evaluation}
            reasoning={aiTelemetry.reasoning}
            pv={aiTelemetry.pv}
            isThinking={isAIThinking}
          />
        )}

        {/* Move History List */}
        <div className="flex-1 min-h-[200px] max-h-[340px] p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Move History
            </h3>
            <span className="text-xs text-slate-500">
              {history.length} {history.length === 1 ? "ply" : "plies"}
            </span>
          </div>

          <div
            id="move-history-scroll"
            className="flex-1 overflow-y-auto space-y-1 pr-1 text-sm font-mono"
          >
            {movePairs.length === 0 ? (
              <p className="text-xs text-slate-600 italic py-6 text-center">
                No moves played yet. Drag or click White pieces to begin!
              </p>
            ) : (
              movePairs.map((pair) => (
                <div
                  key={pair.num}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-800/60 text-xs"
                >
                  <span className="text-slate-500 w-8">{pair.num}.</span>
                  <span className="text-slate-200 font-medium flex-1 text-left">
                    {pair.white}
                  </span>
                  <span className="text-amber-400 font-medium flex-1 text-left">
                    {pair.black || (isAIThinking && pair.num === movePairs.length ? "..." : "")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
