import api from './api';

export const getWallet = () => api.get('/wallet');
export const getTransactions = () => api.get('/wallet/transactions');
export const deposit = (amount: number) => api.post('/wallet/deposit', { amount });
export const withdraw = (amount: number) => api.post('/wallet/withdraw', { amount });
