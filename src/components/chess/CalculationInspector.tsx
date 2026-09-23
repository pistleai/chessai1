"use client";

import React, { useState } from "react";
import { CandidateMoveEval, DepthIterationInfo, SearchStats } from "@/lib/ai/chessAI";
import { EvaluationBreakdown } from "@/lib/ai/evaluation";

export interface CalculationDetails {
  candidateMoves?: CandidateMoveEval[];
  depthIterations?: DepthIterationInfo[];
  stats?: SearchStats;
  pruningEfficiency?: number;
  evalBreakdown?: EvaluationBreakdown;
  estimatedFullTree?: number;
  nominalNodes?: number;
}

export interface CalculationInspectorProps {
  calculationDetails?: CalculationDetails;
  isThinking?: boolean;
}

export default function CalculationInspector({
  calculationDetails,
  isThinking = false,
}: CalculationInspectorProps) {
  const [activeTab, setActiveTab] = useState<"candidates" | "pruning" | "formula" | "timeline">(
    "candidates"
  );

  const stats = calculationDetails?.stats;
  const candidateMoves = calculationDetails?.candidateMoves ?? [];
  const evalBreakdown = calculationDetails?.evalBreakdown;
  const depthIterations = calculationDetails?.depthIterations ?? [];
  const efficiency = calculationDetails?.pruningEfficiency ?? 0;

  return (
    <div
      id="calculation-inspector"
      className="w-full xl:w-[380px] 2xl:w-[420px] rounded-xl bg-slate-900/95 border border-slate-800 p-4 text-slate-300 text-sm flex flex-col gap-3.5 shadow-2xl backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <div>
            <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider">
              Algorithm Inspector
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">Live Search & Math Breakdown</p>
          </div>
        </div>

        {isThinking ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-700/60 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
            COMPUTING
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
            SYNCED
          </span>
        )}
      </div>

      {/* Algorithm Pills */}
      <div className="flex flex-wrap gap-1 text-[10px] font-mono">
        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-amber-300">
          Negamax
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-cyan-300">
          Alpha-Beta (α-β)
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-emerald-300">
          Transposition Table
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-indigo-300">
          PST Heuristics
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-medium">
        <button
          onClick={() => setActiveTab("candidates")}
          className={`py-1 rounded transition text-center ${
            activeTab === "candidates"
              ? "bg-slate-800 text-amber-300 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Candidates
        </button>
        <button
          onClick={() => setActiveTab("pruning")}
          className={`py-1 rounded transition text-center ${
            activeTab === "pruning"
              ? "bg-slate-800 text-cyan-300 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Pruning
        </button>
        <button
          onClick={() => setActiveTab("formula")}
          className={`py-1 rounded transition text-center ${
            activeTab === "formula"
              ? "bg-slate-800 text-emerald-300 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Formula
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`py-1 rounded transition text-center ${
            activeTab === "timeline"
              ? "bg-slate-800 text-violet-300 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Timeline
        </button>
      </div>

      {/* TAB 1: Candidate Moves Comparison */}
      {activeTab === "candidates" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Root Moves Considered ({candidateMoves.length})</span>
            <span className="text-[10px] text-slate-500 font-mono">White Perspective</span>
          </div>

          {candidateMoves.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              Play a move to see candidate evaluations.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
              {candidateMoves.slice(0, 8).map((cand, idx) => {
                const scoreStr =
                  cand.whiteScore > 0
                    ? `+${cand.whiteScore.toFixed(2)}`
                    : cand.whiteScore.toFixed(2);

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-xs flex flex-col gap-1 transition ${
                      cand.isBest
                        ? "bg-emerald-950/40 border-emerald-500/50 shadow-sm"
                        : "bg-slate-950/60 border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold text-[10px]">#{idx + 1}</span>
                        <span className="font-bold text-slate-100 text-sm">{cand.san}</span>
                        <span className="text-[10px] text-slate-500">({cand.from}→{cand.to})</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold font-mono ${
                            cand.whiteScore >= 0 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {scoreStr}
                        </span>

                        {cand.isBest ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            CHOSEN BEST
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            REJECTED {cand.scoreDelta !== undefined && `(Δ ${cand.scoreDelta})`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="truncate pr-2">{cand.rationale}</span>
                      <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                        {cand.nodes.toLocaleString()} nodes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Pruning & Efficiency (Alpha-Beta in Action) */}
      {activeTab === "pruning" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Cumulative Search Totals
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Total: {stats?.totalNodes?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Classic α-β Cutoffs</p>
              <p className="text-base font-mono font-bold text-cyan-400">
                {stats?.classicCutoffs?.toLocaleString() ?? 0}
              </p>
              <p className="text-[9px] text-slate-500">Branches pruned early</p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-medium">TT Immediate Prunes</p>
              <p className="text-base font-mono font-bold text-emerald-400">
                {stats?.ttCutoffs?.toLocaleString() ?? 0}
              </p>
              <p className="text-[9px] text-slate-500">Hash table bounds hit</p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Quiescence Nodes</p>
              <p className="text-base font-mono font-bold text-amber-300">
                {stats?.qNodes?.toLocaleString() ?? 0}
              </p>
              <p className="text-[9px] text-slate-500">
                {stats?.quiescenceCutoffs ?? 0} cutoffs triggered
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Pruning Efficiency</p>
              <p className="text-base font-mono font-bold text-violet-300">
                {efficiency}%
              </p>
              <p className="text-[9px] text-slate-500">(Estimated vs b^d tree)</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
            <span className="font-semibold text-slate-300">💡 Why Alpha-Beta Matters:</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Without Alpha-Beta pruning, evaluating depth 4 would require searching ~1,500,000 moves.
              With move ordering and Transposition Tables, the engine achieves the exact same optimal
              score by searching only ~5,000 nodes!
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: Static Evaluation Formula Breakdown */}
      {activeTab === "formula" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Static Evaluation Formula
            </span>
            <span className="text-[10px] text-slate-500 font-mono">White Perspective</span>
          </div>

          {evalBreakdown ? (
            <div className="flex flex-col gap-2">
              {/* Formula Equation Banner */}
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-center text-slate-300">
                Score = (Mat_W - Mat_B) + (PST_W - PST_B)
              </div>

              {/* Material Row */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">Material Balance</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    W: {evalBreakdown.whiteMaterial} | B: {evalBreakdown.blackMaterial}
                  </p>
                </div>
                <span
                  className={`font-mono font-bold text-sm ${
                    evalBreakdown.materialDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {evalBreakdown.materialDiff >= 0
                    ? `+${(evalBreakdown.materialDiff / 100).toFixed(2)}`
                    : (evalBreakdown.materialDiff / 100).toFixed(2)}
                </span>
              </div>

              {/* Positional PST Row */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">Positional PST Bonus</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    W: {evalBreakdown.whitePST} | B: {evalBreakdown.blackPST}
                  </p>
                </div>
                <span
                  className={`font-mono font-bold text-sm ${
                    evalBreakdown.pstDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {evalBreakdown.pstDiff >= 0
                    ? `+${(evalBreakdown.pstDiff / 100).toFixed(2)}`
                    : (evalBreakdown.pstDiff / 100).toFixed(2)}
                </span>
              </div>

              {/* Game Phase Bar */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Game Phase (Non-Pawn Material)</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {evalBreakdown.gamePhase >= 0.75
                      ? "Opening"
                      : evalBreakdown.gamePhase >= 0.35
                      ? "Middlegame"
                      : "Endgame"} ({(evalBreakdown.gamePhase * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.round(evalBreakdown.gamePhase * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              Awaiting position evaluation breakdown...
            </p>
          )}
        </div>
      )}

      {/* TAB 4: Per-Depth Iteration Timeline */}
      {activeTab === "timeline" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Per-Depth Iteration Timeline
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Isolated Contributions</span>
          </div>

          {depthIterations.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              Depth iterations appear during search (especially in Expert mode).
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
              {depthIterations.map((iter) => (
                <div
                  key={iter.depth}
                  className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                      D{iter.depth}
                    </span>
                    <span className="font-bold text-slate-100">{iter.bestMoveSan}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-400">{iter.nodes.toLocaleString()} nodes</span>
                    <span className="text-cyan-400">{iter.timeMs}ms</span>
                    <span
                      className={`font-bold ${
                        iter.whiteScore >= 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {iter.whiteScore >= 0
                        ? `+${iter.whiteScore.toFixed(2)}`
                        : iter.whiteScore.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
