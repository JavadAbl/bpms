import { apiFetch } from './client';

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{
      accessToken: string;
      userId: string;
      username: string;
      email: string;
      name: string;
      role: string;
    }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, email: string, name: string, password: string) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, name, password }),
    }),
};
