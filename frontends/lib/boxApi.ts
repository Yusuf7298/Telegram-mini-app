import api from './api';

export const getBoxes = () => api.get('/game/boxes');
export const openBox = (boxId: string, idempotencyKey: string) =>
	api.post('/game/open-box', { boxId, idempotencyKey });
