import { apiFetch } from './api';
import { isDemoMode } from './worksApi';
import { SettingCandidate, SettingCandidateReviewStatus } from '../components/catchhole/types';
import { MOCK_SETTING_CANDIDATES } from '../components/catchhole/mockEpisodeData';

const DEMO_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getSettingCandidates(workId: string, episodeIds?: string[]): Promise<SettingCandidate[]> {
  if (isDemoMode() || !workId) {
    await delay(DEMO_DELAY_MS);
    if (!episodeIds || episodeIds.length === 0) return [...MOCK_SETTING_CANDIDATES];
    return MOCK_SETTING_CANDIDATES.filter((c) => episodeIds.includes(c.episodeId));
  }
  const params = episodeIds && episodeIds.length > 0
    ? '?' + episodeIds.map((id) => `episodeId=${encodeURIComponent(id)}`).join('&')
    : '';
  const candidates = await apiFetch<SettingCandidate[]>(
    `/api/v1/works/${workId}/settings/candidates${params}`,
  );
  return candidates ?? [];
}

export interface CandidatePatch {
  reviewStatus?: SettingCandidateReviewStatus;
  editedValue?: string | null;
}

export async function updateCandidate(workId: string, candidateId: string, patch: CandidatePatch): Promise<void> {
  if (isDemoMode() || !workId) return;
  await apiFetch<void>(`/api/v1/works/${workId}/settings/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
