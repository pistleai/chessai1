import { Move } from 'chess.js';

export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: Move | null;
}

/**
 * Global Transposition Table mapping position key (FEN) to search results.
 */
export const transpositionTable = new Map<string, TTEntry>();

/**
 * Normalizes a FEN string to extract the core position key
 * (board pieces, active color, castling rights, en-passant square),
 * ignoring halfmove and fullmove clocks so identical transpositions match.
 *
 * @param fen Complete FEN string
 * @returns Normalized 4-tuple position key
 */
export function getPositionKey(fen: string): string {
  const parts = fen.split(' ');
  return parts.slice(0, 4).join(' ');
}

/**
 * Resets the transposition table.
 */
export function clearTranspositionTable(): void {
  transpositionTable.clear();
}

/**
 * Class wrapper for TranspositionTable matching project interface conventions.
 */
export class TranspositionTable {
  private table = transpositionTable;

  public get(key: string): TTEntry | undefined {
    return this.table.get(getPositionKey(key));
  }

  public set(key: string, entry: TTEntry): void {
    this.table.set(getPositionKey(key), entry);
  }

  public clear(): void {
    this.table.clear();
  }

  public size(): number {
    return this.table.size;
  }
}
