import { create } from 'zustand';
import { getTransactions, getWallet, TransactionsData, WalletData } from '@/lib/walletApi';

export const WALLET_REFRESH_EVENT = 'wallet:refresh';

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter?: number;
  createdAt: string;
}

interface WalletState {
  cashBalance: number;
  bonusBalance: number;
  airtimeBalance: number;
  transactions: WalletTransaction[];
  loading: boolean;
  error: string | null;
  fetchWallet: () => Promise<void>;
  updateWalletFromResponse: (payload: unknown) => boolean;
  syncFromMutationResponse: (payload: unknown) => Promise<void>;
}

let inFlightWalletRequest: Promise<void> | null = null;

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replaceAll(',', '').trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function extractWalletPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (data.wallet && typeof data.wallet === 'object') {
    return data.wallet as Record<string, unknown>;
  }

  if (
    Object.prototype.hasOwnProperty.call(data, 'cashBalance') ||
    Object.prototype.hasOwnProperty.call(data, 'bonusBalance') ||
    Object.prototype.hasOwnProperty.call(data, 'airtimeBalance')
  ) {
    return data;
  }

  return null;
}

function normalizeTransaction(item: unknown): WalletTransaction | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const tx = item as Record<string, unknown>;
  const id = String(tx.id ?? '');
  const type = String(tx.type ?? '');
  const createdAt = String(tx.createdAt ?? '');

  if (!id || !type || !createdAt) {
    return null;
  }

  return {
    id,
    type,
    amount: toSafeNumber(tx.amount),
    balanceAfter: tx.balanceAfter !== undefined ? toSafeNumber(tx.balanceAfter) : undefined,
    createdAt,
  };
}

export const useWalletStore = create<WalletState>((set, get) => ({
  cashBalance: 0,
  bonusBalance: 0,
  airtimeBalance: 0,
  transactions: [],
  loading: false,
  error: null,

  fetchWallet: async () => {
    if (inFlightWalletRequest) {
      return inFlightWalletRequest;
    }

    inFlightWalletRequest = (async () => {
      set({ loading: true, error: null });

      try {
        const [walletRes, txRes] = await Promise.all([getWallet(), getTransactions()]);

        const wallet: WalletData = walletRes.data.data;
        const txPayload: TransactionsData = txRes.data.data;
        const txArray = Array.isArray(txPayload)
          ? txPayload
          : Array.isArray(txPayload?.transactions)
            ? txPayload.transactions
            : [];

        const normalizedTransactions = txArray
          .map((tx) => normalizeTransaction(tx))
          .filter((tx): tx is WalletTransaction => tx !== null);

        set({
          cashBalance: toSafeNumber(wallet.cashBalance),
          bonusBalance: toSafeNumber(wallet.bonusBalance),
          airtimeBalance: toSafeNumber(wallet.airtimeBalance),
          transactions: normalizedTransactions,
          loading: false,
          error: null,
        });

      } catch (error) {
        const message =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data
            ?.error?.message === 'string'
            ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
                ?.message ?? 'Failed to load wallet data'
            : 'Failed to load wallet data';

        set({
          loading: false,
          error: message,
        });
      } finally {
        inFlightWalletRequest = null;
      }
    })();

    return inFlightWalletRequest;
  },

  syncFromMutationResponse: async (payload: unknown) => {
    const updated = get().updateWalletFromResponse(payload);
    if (!updated) {
      await get().fetchWallet();
    }
  },

  updateWalletFromResponse: (payload: unknown) => {
    const nextWallet = extractWalletPayload(payload);

    if (!nextWallet) {
      return false;
    }

    set({
      cashBalance: toSafeNumber(nextWallet.cashBalance),
      bonusBalance: toSafeNumber(nextWallet.bonusBalance),
      airtimeBalance: toSafeNumber(nextWallet.airtimeBalance),
    });

    return true;
  },
}));

