import api from './apiClient';
import { ApiResponse } from './apiTypes';

export type WalletData = {
	cashBalance: number | string;
	bonusBalance: number | string;
	airtimeBalance: number | string;
};

export type WalletTransactionApi = {
	id: string;
	type: string;
	amount: number;
	balanceAfter?: number;
	createdAt: string;
};

export type TransactionsData = WalletTransactionApi[] | { transactions?: WalletTransactionApi[] };

export const getWallet = () => api.get<ApiResponse<WalletData>>('/api/wallet');
export const getTransactions = () => api.get<ApiResponse<TransactionsData>>('/api/wallet/transactions');
export const deposit = (amount: number) => api.post<ApiResponse<{ amount: number }>>('/api/wallet/deposit', { amount });
export const withdraw = (amount: number) => api.post<ApiResponse<{ amount: number }>>('/api/wallet/withdraw', { amount });
