import type { WorkResponse as GeneratedWorkResponse } from '../api/generated/types.gen';

export interface Work {
  id: string;
  title: string;
  genre: string | null;
  description: string | null;
  episodeCount: number;
  lifecycleStatus: 'ACTIVE' | 'PURGING';
}

export const DEMO_CHARACTER_STATE_KEY = 'catchhole_demo_character_state';

/** 작품 화면은 실제 API를 사용하고, 체험 화면은 별도의 fixture를 사용한다. */
export function isDemoMode(): boolean {
  return false;
}

export function toWork(res: GeneratedWorkResponse): Work | null {
  if (!res.id || !res.title || typeof res.latestEpisodeNo !== 'number') return null;
  return {
    id: res.id,
    title: res.title,
    genre: res.genre ?? '',
    description: res.description ?? null,
    episodeCount: res.latestEpisodeNo,
    lifecycleStatus: res.lifecycleStatus,
  };
}
