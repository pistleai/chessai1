"use client";

import React from "react";

export interface AIStatsProps {
  depth?: number;
  nodesEvaluated?: number;
  searchTimeMs?: number;
  bestMove?: string;
  score?: number;
  reasoning?: string;
  pv?: string[];
  isThinking?: boolean;
}

export default function AIStats({
  depth,
  nodesEvaluated,
  searchTimeMs,
  bestMove,
  score,
  reasoning,
  pv,
  isThinking = false,
}: AIStatsProps) {
  const nps =
    nodesEvaluated && searchTimeMs && searchTimeMs > 0
      ? Math.round((nodesEvaluated / searchTimeMs) * 1000)
      : null;

  return (
    <div
      id="ai-stats-card"
      className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 text-slate-300 text-sm flex flex-col gap-2.5 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
            AI Engine Telemetry
          </h3>
        </div>
        {isThinking ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-700/60 animate-pulse">
            SEARCHING
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            READY
          </span>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Depth</p>
          <p className="text-sm font-mono font-bold text-amber-300">
            {depth !== undefined ? `D${depth}` : "—"}
          </p>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Nodes</p>
          <p className="text-sm font-mono font-bold text-slate-100">
            {nodesEvaluated !== undefined ? nodesEvaluated.toLocaleString() : "—"}
          </p>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Speed</p>
          <p className="text-sm font-mono font-bold text-slate-100">
            {searchTimeMs !== undefined ? `${searchTimeMs}ms` : "—"}
          </p>
        </div>
      </div>

      {/* NPS & Score Row */}
      <div className="text-[11px] text-slate-500 flex justify-between px-1">
        <span>{nps !== null ? `${nps.toLocaleString()} nodes/s` : "Idle"}</span>
        {score !== undefined && (
          <span className="font-mono text-slate-300 font-semibold">
            Score: {score > 0 ? `+${(score / 100).toFixed(2)}` : (score / 100).toFixed(2)}
          </span>
        )}
      </div>

      {/* Best Move */}
      {bestMove && (
        <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
          <span>Engine Choice</span>
          <span className="font-mono text-amber-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {bestMove}
          </span>
        </div>
      )}

      {/* Move Reasoning & Explanation */}
      {reasoning && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Move Reasoning
          </p>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-indigo-900/40 text-xs text-indigo-200 font-medium flex items-center gap-1.5">
            <span>💡</span>
            <span>{reasoning}</span>
          </div>
        </div>
      )}

      {/* Principal Variation (PV Line) */}
      {pv && pv.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Anticipated Line (PV)
          </p>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-amber-200/90 tracking-wide">
            {pv.map((san, idx) => (
              <span key={idx} className="mr-1.5">
                <span className="text-slate-500">{idx + 1}.</span> {san}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
