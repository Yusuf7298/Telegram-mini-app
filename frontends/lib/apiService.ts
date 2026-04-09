import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// --- API Base URL ---
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.boxplay.app',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Types ---
export interface LoginRequest {
  phone: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: User;
}

export interface SignupRequest {
  phone: string;
  password: string;
  referralCode?: string;
}
export interface SignupResponse {
  token: string;
  user: User;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}
export interface VerifyOtpResponse {
  token: string;
  user: User;
}

export interface OpenBoxRequest {
  boxType: string;
}
export interface OpenBoxResponse {
  prize: Prize;
  box: Box;
}

export interface WalletResponse {
  balance: number;
  transactions: Transaction[];
}

export interface RewardsResponse {
  rewards: Reward[];
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface ReferralsResponse {
  referrals: Referral[];
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
export interface Reward {
  id: string;
  name: string;
  value: number;
  claimed: boolean;
}
export interface LeaderboardEntry {
  user: User;
  prize: Prize;
  wonAt: string;
}
export interface Referral {
  id: string;
  referredUser: User;
  reward: number;
  joinedAt: string;
}

// --- API Service ---
const ApiService = {
  login: (data: LoginRequest, config?: AxiosRequestConfig) =>
    api.post<LoginResponse>('/auth/login', data, config),

  signup: (data: SignupRequest, config?: AxiosRequestConfig) =>
    api.post<SignupResponse>('/auth/signup', data, config),

  verifyOtp: (data: VerifyOtpRequest, config?: AxiosRequestConfig) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', data, config),

  openBox: (data: OpenBoxRequest, config?: AxiosRequestConfig) =>
    api.post<OpenBoxResponse>('/boxes/open', data, config),

  getWallet: (config?: AxiosRequestConfig) =>
    api.get<WalletResponse>('/wallet', config),

  getRewards: (config?: AxiosRequestConfig) =>
    api.get<RewardsResponse>('/rewards', config),

  getLeaderboard: (config?: AxiosRequestConfig) =>
    api.get<LeaderboardResponse>('/leaderboard', config),

  getReferrals: (config?: AxiosRequestConfig) =>
    api.get<ReferralsResponse>('/referrals', config),
};

export default ApiService;
