import { create } from 'zustand';
import ApiService from '@/lib/apiService';

interface WalletState {
  cashBalance: number;
  bonusBalance: number;
  fetchWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  cashBalance: 0,
  bonusBalance: 0,
  fetchWallet: async () => {
    try {
      const { data } = await ApiService.getWallet();
      const wallet = data.data;

      set({
        cashBalance: wallet?.cashBalance ?? 0,
        bonusBalance: wallet?.bonusBalance ?? 0,
      });
    } catch (e) {
      // handle error
    }
  },
}));
