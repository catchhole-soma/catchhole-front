import { apiFetch } from './api';

export const ACCESS_TOKEN_KEY = 'accessToken';

interface AuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<void> {
  const { accessToken } = await apiFetch<AuthTokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}
