import type {
  EpisodeUploadRequest,
  EpisodeUploadResponse,
} from '../api/generated/types.gen';
import { apiFetch, apiFetchForm } from './api';

export interface Work {
  id: string;
  title: string;
  genre: string | null;
  episodeCount: number;
}

const DEMO_MODE_KEY = 'catchhole_demo_mode';
const DEMO_WORKS_KEY = 'catchhole_demo_works';
const DEMO_DELAY_MS = 600;

const DEFAULT_DEMO_WORKS: Work[] = [
  { id: 'detective', title: '탐정 사무소의 비밀', genre: '추리', episodeCount: 12 },
  { id: 'murim', title: '무림 세계의 전설', genre: '무협', episodeCount: 8 },
];

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function setDemoMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(DEMO_MODE_KEY);
    localStorage.removeItem(DEMO_WORKS_KEY);
  }
}

function loadDemoWorks(): Work[] {
  const raw = localStorage.getItem(DEMO_WORKS_KEY);
  if (!raw) return DEFAULT_DEMO_WORKS;
  try {
    return JSON.parse(raw) as Work[];
  } catch {
    return DEFAULT_DEMO_WORKS;
  }
}

function saveDemoWorks(works: Work[]): void {
  localStorage.setItem(DEMO_WORKS_KEY, JSON.stringify(works));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface CreateWorkInput {
  title: string;
  genre: string;
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
  latestEpisodeNo: number;
}

function toWork(res: WorkResponse): Work {
  return { id: res.id, title: res.title, genre: res.genre, episodeCount: res.latestEpisodeNo };
}

export async function getWorks(): Promise<Work[]> {
  if (isDemoMode()) {
    await delay(DEMO_DELAY_MS);
    return loadDemoWorks();
  }
  const works = await apiFetch<WorkResponse[]>('/api/v1/works');
  return (works ?? []).map(toWork);
}

export async function createWork(input: CreateWorkInput): Promise<CreateWorkResult> {
  if (isDemoMode()) {
    await delay(DEMO_DELAY_MS);
    const works = loadDemoWorks();
    const workId = `demo-${Date.now()}`;
    works.push({ id: workId, title: input.title, genre: input.genre, episodeCount: 1 });
    saveDemoWorks(works);
    return { workId };
  }

  const work = await apiFetch<WorkResponse>('/api/v1/works', {
    method: 'POST',
    body: JSON.stringify({ title: input.title, genre: input.genre, description: null }),
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
  if (isDemoMode()) {
    await delay(DEMO_DELAY_MS);
    const works = loadDemoWorks();
    const work = works.find(w => w.id === input.workId);
    if (work) {
      work.episodeCount += 1;
      saveDemoWorks(works);
    }
    return { batchId: `demo-batch-${Date.now()}`, episodeCount: 1 };
  }

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
