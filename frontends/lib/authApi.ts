import api from './api';

export const login = (username: string, password: string) => api.post('/auth/login', { username, password });
export const logout = () => api.post('/auth/logout');
export const getProfile = () => api.get('/auth/profile');
