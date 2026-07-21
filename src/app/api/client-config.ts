import type { CreateClientConfig } from './generated/client.gen';
import { API_BASE_URL, getAccessToken } from '../lib/api-config';
import { fetchWithAuth } from '../lib/auth-fetch';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  auth: () => getAccessToken() ?? '',
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: fetchWithAuth,
});
