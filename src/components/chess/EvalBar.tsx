"use client";

import React from "react";

export interface EvalBarProps {
  evaluation: number; // In centipawns from White's perspective (+ = White advantage, - = Black advantage)
  isCheckmate?: boolean;
}

export default function EvalBar({ evaluation, isCheckmate = false }: EvalBarProps) {
  // Convert evaluation into percentage for White advantage
  // Using standard clamped linear scaling [-1000, 1000] centipawns -> [5%, 95%]
  let whitePercent = 50;
  let label = "0.0";
  let isMate = false;

  if (evaluation === Infinity || (isCheckmate && evaluation > 0)) {
    whitePercent = 100;
    label = "M";
    isMate = true;
  } else if (evaluation === -Infinity || (isCheckmate && evaluation < 0)) {
    whitePercent = 0;
    label = "-M";
    isMate = true;
  } else if (Math.abs(evaluation) >= 15000) {
    whitePercent = evaluation > 0 ? 100 : 0;
    label = evaluation > 0 ? "M" : "-M";
    isMate = true;
  } else {
    // Clamped linear scale from -1000 to +1000 centipawns
    const clamped = Math.max(-1000, Math.min(1000, evaluation));
    whitePercent = Math.round(((clamped + 1000) / 2000) * 100);

    // Limit extreme edges so label text fits
    whitePercent = Math.max(7, Math.min(93, whitePercent));

    const pawns = evaluation / 100;
    if (Math.abs(pawns) < 0.05) {
      label = "0.0";
    } else {
      label = (pawns > 0 ? "+" : "") + pawns.toFixed(1);
    }
  }

  const isWhiteWinning = whitePercent >= 50;

  return (
    <div
      id="eval-bar"
      aria-label={`Evaluation: ${label}`}
      className="relative w-7 md:w-8 h-[380px] sm:h-[460px] md:h-[560px] rounded-lg bg-slate-900 border border-slate-700/80 overflow-hidden shadow-2xl flex flex-col justify-end select-none"
    >
      {/* Black's section (Top) */}
      <div className="absolute inset-x-0 top-0 bottom-0 bg-slate-900" />

      {/* White's section (Bottom, fills upwards) */}
      <div
        className="w-full bg-slate-100 transition-all duration-500 ease-out"
        style={{ height: `${whitePercent}%` }}
      />

      {/* Floating Score Badge */}
      <div
        className={`absolute inset-x-0 flex items-center justify-center pointer-events-none transition-all duration-500 ${
          isWhiteWinning ? "bottom-2" : "top-2"
        }`}
      >
        <span
          className={`text-[10px] sm:text-xs font-mono font-extrabold tracking-tight px-1 py-0.5 rounded shadow-sm ${
            isWhiteWinning
              ? "text-slate-900 bg-white/90"
              : "text-slate-100 bg-slate-950/90"
          } ${isMate ? "animate-pulse" : ""}`}
        >
          {label}
        </span>
      </div>

      {/* Midline Indicator (0.0 balance) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-500/40 pointer-events-none z-10" />
    </div>
  );
}
