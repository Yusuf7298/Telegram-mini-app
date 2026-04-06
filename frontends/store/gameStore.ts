import { create } from 'zustand';
import { Prize } from '@/lib/apiService';

interface GameState {
  boxesOpened: number;
  bonusProgress: number;
  lastWin: Prize | null;
}

export const useGameStore = create<GameState>(() => ({
  boxesOpened: 0,
  bonusProgress: 0,
  lastWin: null,
}));
