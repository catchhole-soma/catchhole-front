import { apiFetch, ACCESS_TOKEN_KEY } from './api';

export { ACCESS_TOKEN_KEY };

interface AuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthSignupRequest {
  email: string;
  password: string;
  phoneNumber: string;
  displayName: string;
}

interface MemberResponse {
  id: number;
  email: string;
  phoneNumber: string;
  phoneVerified: boolean;
  displayName: string;
  profileImageUrl: string | null;
  status: string;
  role: string;
}

export async function login(email: string, password: string): Promise<void> {
  const { accessToken } = await apiFetch<AuthTokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export async function signup(data: AuthSignupRequest): Promise<void> {
  await apiFetch<MemberResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  await login(data.email, data.password);
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<unknown>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}
