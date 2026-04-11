import { AxiosRequestConfig } from 'axios';
import api from './api';

export interface OpenBoxRequest {
  boxId: string;
  idempotencyKey: string;
}
export interface OpenBoxResponse {
  success: boolean;
  data: unknown;
  error: string | null;
}

export interface WalletResponse {
  success: boolean;
  data: {
    id: string;
    userId: string;
    cashBalance: number;
    bonusBalance: number;
  };
  error: string | null;
}

// --- Entity Types ---
export interface User {
  id: string;
  username: string;
  phone: string;
  avatar?: string;
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
  openBox: (data: OpenBoxRequest, config?: AxiosRequestConfig) =>
    api.post<OpenBoxResponse>('/game/open-box', data, config),

  getWallet: (config?: AxiosRequestConfig) =>
    api.get<WalletResponse>('/wallet', config),
};

export default ApiService;
