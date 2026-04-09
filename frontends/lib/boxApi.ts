import api from './api';

export const getBoxes = () => api.get('/boxes');
export const openBox = (boxId: string) => api.post(`/boxes/${boxId}/open`);
export const getPrizes = () => api.get('/prizes');
