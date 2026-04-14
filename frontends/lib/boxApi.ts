import api from './apiClient';
import { ApiResponse } from './apiTypes';

export interface BoxData {
	id: string;
	name: string;
	price: string | number;
}

export interface OpenBoxResult {
	reward?: number | string;
}

export const getBoxes = () => api.get<ApiResponse<BoxData[]>>('/game/boxes');

export interface OpenBoxPayload {
	boxId: string;
	idempotencyKey: string;
	timestamp: number;
}

export const openBox = (payload: OpenBoxPayload) =>
	api.post<ApiResponse<OpenBoxResult>>('/game/open-box', payload);
