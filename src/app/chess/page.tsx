import React from "react";
import ChessBoard from "@/components/chess/ChessBoard";

export const metadata = {
  title: "Chess AI - Human vs Human & AI Engine",
  description: "Play chess with full rule validation, move evaluation, and AI engine.",
};

export default function ChessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start py-10 px-4 md:px-8 selection:bg-amber-500/30">
      <div className="w-full max-w-[1440px] flex flex-col items-center gap-8">
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-1.5">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Chess AI
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">
            Explainable AI Engine (Negamax, Alpha-Beta, Quiescence & Web Worker Offloaded)
          </p>
        </header>

        {/* Interactive Chessboard */}
        <ChessBoard />
      </div>
    </main>
  );
}
