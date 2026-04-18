import api from './apiClient';
import { ApiResponse } from './apiTypes';

export interface BoxData {
	id: string;
	name: string;
	price: string | number;
}

export interface OpenBoxResult {
	reward?: number | string;
	referralActivation?: {
		referredUserId: string;
		referrerId: string;
		rewardAmount: string;
	};
	walletSnapshot?: {
		cashBalance?: number | string;
		bonusBalance?: number | string;
	};
}

export const getBoxes = () => api.get<ApiResponse<BoxData[]>>('/game/boxes');

export interface OpenBoxPayload {
	boxId: string;
	idempotencyKey: string;
	timestamp: number;
}

export interface FreeBoxPayload {
	idempotencyKey: string;
	timestamp: number;
}

export const openBox = (payload: OpenBoxPayload) =>
	api.post<ApiResponse<OpenBoxResult>>('/api/game/open-box', payload);

export const openFreeBox = (payload: FreeBoxPayload) =>
	api.post<ApiResponse<OpenBoxResult>>('/api/game/free-box', payload);
