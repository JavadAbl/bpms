import { apiFetch } from '@/lib/api/client';
import type { LoginReply } from './types';

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginReply>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, email: string, name: string, password: string) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, name, password }),
    }),
};
