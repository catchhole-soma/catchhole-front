import type {
  EpisodeUploadRequest,
  EpisodeUploadResponse,
} from '../api/generated/types.gen';
import { apiFetch, apiFetchForm } from './api';
import type { WorkResponse as GeneratedWorkResponse } from '../api/generated/types.gen';

export interface Work {
  id: string;
  title: string;
  genre: string | null;
  description: string | null;
  episodeCount: number;
}

export const DEMO_CHARACTER_STATE_KEY = 'catchhole_demo_character_state';

/** 레거시 빌더 코드가 참조하는 동안 항상 실제 API 모드만 반환한다. */
export function isDemoMode(): boolean {
  return false;
}

export interface CreateWorkInput {
  title: string;
  genre: string;
  description?: string | null;
  episodeFile: File;
  settingsFile?: File | null;
}

export interface CreateWorkResult {
  workId: string;
}

export interface UploadSingleEpisodeInput {
  workId: string;
  episodeNo: number;
  sourceEpisodeFile: File;
  attachedSettingBookFile?: File | null;
}

export type UploadSingleEpisodeResult = Pick<
  EpisodeUploadResponse,
  'batchId' | 'episodeCount'
>;

/** 백엔드 WorkController가 반환하는 작품 응답 (필요한 필드만) */
interface WorkResponse {
  id: string;
  title: string;
  genre: string | null;
  description?: string | null;
  latestEpisodeNo: number;
}

export function toWork(res: GeneratedWorkResponse): Work | null {
  if (!res.id || !res.title || typeof res.latestEpisodeNo !== 'number') return null;
  return {
    id: res.id,
    title: res.title,
    genre: res.genre ?? '',
    description: res.description ?? null,
    episodeCount: res.latestEpisodeNo,
  };
}

export async function getWorks(): Promise<Work[]> {
  const works = await apiFetch<WorkResponse[]>('/api/v1/works');
  return (works ?? []).map(res => ({
    id: res.id,
    title: res.title,
    genre: res.genre,
    description: res.description ?? null,
    episodeCount: res.latestEpisodeNo,
  }));
}

export async function createWork(input: CreateWorkInput): Promise<CreateWorkResult> {
  const work = await apiFetch<WorkResponse>('/api/v1/works', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      genre: input.genre,
      description: input.description?.trim() || null,
    }),
  });

  await uploadSingleEpisode({
    workId: work.id,
    episodeNo: 1,
    sourceEpisodeFile: input.episodeFile,
    attachedSettingBookFile: input.settingsFile,
  });

  return { workId: work.id };
}

export async function uploadSingleEpisode(
  input: UploadSingleEpisodeInput,
): Promise<UploadSingleEpisodeResult> {
  const formData = new FormData();
  const metadata: EpisodeUploadRequest = {
    uploadType: 'SINGLE_EPISODE',
    singleEpisodeNo: input.episodeNo,
  };
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('episodeFiles', input.sourceEpisodeFile);
  if (input.attachedSettingBookFile) {
    formData.append('settingBookFile', input.attachedSettingBookFile);
  }

  return apiFetchForm<EpisodeUploadResponse>(`/api/v1/works/${input.workId}/episodes`, formData);
}
