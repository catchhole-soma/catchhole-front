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

export interface UploadEpisodeInput {
  workId: string;
  episodeNumber: number;
  file: File;
  settingsFile?: File | null;
}

export interface UploadEpisodeResult {
  batchId: string;
  episodeCount: number;
}

/** 백엔드 WorkController가 반환하는 작품 응답 (필요한 필드만) */
interface WorkResponse {
  id: string;
  title: string;
  genre: string | null;
  latestEpisodeNo: number;
}

/** 백엔드 EpisodeController.uploadEpisodes가 반환하는 업로드 응답 (필요한 필드만) */
interface EpisodeUploadResponse {
  batchId: string;
  episodeCount: number;
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

  await uploadEpisode({
    workId: work.id,
    episodeNumber: 1,
    file: input.episodeFile,
    settingsFile: input.settingsFile,
  });

  return { workId: work.id };
}

export async function uploadEpisode(input: UploadEpisodeInput): Promise<UploadEpisodeResult> {
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
  const meta = { uploadType: 'SINGLE_EPISODE', episodeNo: input.episodeNumber };
  formData.append('data', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  formData.append('episodeFiles', input.file);
  if (input.settingsFile) {
    formData.append('settingBookFile', input.settingsFile);
  }

  return apiFetchForm<EpisodeUploadResponse>(`/api/v1/works/${input.workId}/episodes`, formData);
}
