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
      set({
        cashBalance: data.balance,
        bonusBalance: data.transactions?.find((t) => t.type === 'bonus')?.amount || 0,
      });
    } catch (e) {
      // handle error
    }
  },
}));
