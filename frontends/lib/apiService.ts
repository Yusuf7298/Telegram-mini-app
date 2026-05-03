import apiClient from './apiClient';
import { ApiResponse } from './apiTypes';

export interface OpenBoxRequest {
  boxId: string;
  idempotencyKey: string;
}

export interface OpenBoxData {
  reward: number | string;
}

export interface WalletData {
  id: string;
  userId: string;
  cashBalance: number;
  bonusBalance: number;
}
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// --- Entity Types ---
export interface User {
  id: string;
  telegramId?: string | null;
  role: UserRole;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  referralCode?: string | null;
  freeBoxUsed?: boolean;
}
export interface Prize {
  id: string;
  name: string;
  image: string;
  value: number;
}
export interface Box {
  id: string;
  type: string;
  openedAt: string;
}
export interface Transaction {
  id: string;
  amount: number;
  type: string;
  createdAt: string;
}

// --- API Service ---
const ApiService = {
  openBox: (data: OpenBoxRequest, config?: any) =>
    apiClient.post('/game/open-box', data, config),

  getWallet: (config?: any) =>
    apiClient.get('/wallet', config),
};

export default ApiService;
