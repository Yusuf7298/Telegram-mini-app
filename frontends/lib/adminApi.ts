import apiClient from './apiClient';
import { ApiResponse } from './apiTypes';

export type AdminMetrics = Record<string, unknown>;

export type RewardItem = {
  id: string;
  boxId: string;
  reward: string | number;
  weight: number;
  category?: string | null;
  label?: string | null;
  isJackpot?: boolean;
  maxWinners?: number | null;
  currentWinners?: number | null;
};

export type RewardPayload = {
  boxId: string;
  reward: number;
  weight: number;
  category?: string;
  label?: string;
  isJackpot?: boolean;
  maxWinners?: number;
  currentWinners?: number;
};

export type AdminUser = {
  id: string;
  platformId?: string;
  username?: string | null;
  riskScore?: number;
  accountStatus: string;
  createdAt: string;
  wallet?: {
    cashBalance: string;
    bonusBalance: string;
    bonusLocked?: boolean;
  } | null;
};

export type FraudEvent = {
  id: string;
  userId: string | null;
  action: string;
  details?: unknown;
  flaggedAt: string;
  reviewed?: boolean;
  user?: {
    id: string;
    username?: string | null;
    platformId?: string;
    accountStatus?: string;
  } | null;
};

function withAdminSecret(adminSecret: string) {
  return {
    headers: {
      'x-admin-secret': adminSecret,
    },
  };
}

function requireSecret(adminSecret: string) {
  if (!adminSecret.trim()) {
    throw new Error('Admin secret is required');
  }
}

export function getSafeErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return 'Something went wrong';
}

export async function getAdminMetrics(adminSecret: string): Promise<AdminMetrics> {
  requireSecret(adminSecret);
  const response = await apiClient.get<ApiResponse<AdminMetrics>>('/api/admin/metrics', withAdminSecret(adminSecret));
  return response.data.data;
}

export async function getRewardsByBox(boxId: string, adminSecret: string): Promise<RewardItem[]> {
  requireSecret(adminSecret);
  const response = await apiClient.get<ApiResponse<RewardItem[]>>(`/api/admin/rewards/${boxId}`, withAdminSecret(adminSecret));
  return response.data.data;
}

export async function createReward(payload: RewardPayload, adminSecret: string): Promise<RewardItem> {
  requireSecret(adminSecret);
  const response = await apiClient.post<ApiResponse<RewardItem>>('/api/admin/rewards', payload, withAdminSecret(adminSecret));
  return response.data.data;
}

export async function updateReward(id: string, payload: RewardPayload, adminSecret: string): Promise<RewardItem> {
  requireSecret(adminSecret);
  const response = await apiClient.put<ApiResponse<RewardItem>>(`/api/admin/rewards/${id}`, payload, withAdminSecret(adminSecret));
  return response.data.data;
}

export async function deleteReward(id: string, adminSecret: string): Promise<void> {
  requireSecret(adminSecret);
  await apiClient.delete(`/api/admin/rewards/${id}`, withAdminSecret(adminSecret));
}

export async function getAdminUsers(adminSecret: string): Promise<AdminUser[]> {
  requireSecret(adminSecret);
  const response = await apiClient.get<ApiResponse<AdminUser[]>>('/api/admin/high-risk-users', withAdminSecret(adminSecret));
  return response.data.data;
}

export async function freezeUser(userId: string, adminSecret: string): Promise<void> {
  requireSecret(adminSecret);
  await apiClient.post('/api/admin/freeze-user', { userId }, withAdminSecret(adminSecret));
}

export async function unfreezeUser(userId: string, adminSecret: string): Promise<void> {
  requireSecret(adminSecret);
  await apiClient.post('/api/admin/unfreeze-user', { userId }, withAdminSecret(adminSecret));
}

export async function getFraudEvents(adminSecret: string): Promise<FraudEvent[]> {
  requireSecret(adminSecret);
  const response = await apiClient.get<ApiResponse<FraudEvent[]>>('/api/admin/fraud-events', withAdminSecret(adminSecret));
  return response.data.data;
}

export async function updateSystemConfig(config: Record<string, unknown>, adminSecret: string): Promise<void> {
  requireSecret(adminSecret);
  await apiClient.post('/api/config/update', config, withAdminSecret(adminSecret));
}
