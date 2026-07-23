import { apiFetch, apiFetchForm } from './api';
import type { WorkResponse as GeneratedWorkResponse } from '../api/generated/types.gen';

export interface Work {
  id: string;
  title: string;
  genre: string | null;
  description: string | null;
  episodeCount: number;
}

const DEMO_MODE_KEY = 'catchhole_demo_mode';
const DEMO_WORKS_KEY = 'catchhole_demo_works';
const DEMO_DELAY_MS = 600;

export const DEMO_WORKS_QUERY_KEY = ['works', 'demo'] as const;

const DEFAULT_DEMO_WORKS: Work[] = [
  { id: 'detective', title: '탐정 사무소의 비밀', genre: '추리', description: null, episodeCount: 12 },
  { id: 'murim', title: '무림 세계의 전설', genre: '무협', description: null, episodeCount: 8 },
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
  description?: string | null;
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
  description?: string | null;
  latestEpisodeNo: number;
}

/** 백엔드 EpisodeController.uploadEpisodes가 반환하는 업로드 응답 (필요한 필드만) */
interface EpisodeUploadResponse {
  batchId: string;
  episodeCount: number;
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

export async function getDemoWorks(): Promise<Work[]> {
  await delay(DEMO_DELAY_MS);
  return loadDemoWorks();
}

export async function createDemoWork(
  input: Pick<CreateWorkInput, 'title' | 'genre' | 'description'>,
): Promise<Work> {
  await delay(DEMO_DELAY_MS);
  const works = loadDemoWorks();
  const work = {
    id: `demo-${Date.now()}`,
    title: input.title,
    genre: input.genre,
    description: input.description?.trim() || null,
    episodeCount: 0,
  };
  saveDemoWorks([work, ...works]);
  return work;
}

export async function getWorks(): Promise<Work[]> {
  if (isDemoMode()) {
    return getDemoWorks();
  }
  const works = await apiFetch<WorkResponse[]>('/api/v1/works');
  return (works ?? []).map(res => ({
    id: res.id,
    title: res.title,
    genre: res.genre,
    description: res.description ?? null,
    episodeCount: res.latestEpisodeNo,
  }));
}

export async function updateDemoWork(
  workId: string,
  input: Pick<CreateWorkInput, 'title' | 'genre' | 'description'>,
): Promise<Work | null> {
  await delay(DEMO_DELAY_MS);
  const works = loadDemoWorks();
  const work = works.find(item => item.id === workId);
  if (!work) return null;
  work.title = input.title;
  work.genre = input.genre;
  work.description = input.description?.trim() || null;
  saveDemoWorks(works);
  return work;
}

export async function deleteDemoWork(workId: string): Promise<boolean> {
  await delay(DEMO_DELAY_MS);
  const works = loadDemoWorks();
  const remainingWorks = works.filter(work => work.id !== workId);
  if (remainingWorks.length === works.length) return false;
  saveDemoWorks(remainingWorks);
  return true;
}

export async function createWork(input: CreateWorkInput): Promise<CreateWorkResult> {
  if (isDemoMode()) {
    await delay(DEMO_DELAY_MS);
    const works = loadDemoWorks();
    const workId = `demo-${Date.now()}`;
    works.push({
      id: workId,
      title: input.title,
      genre: input.genre,
      description: input.description?.trim() || null,
      episodeCount: 1,
    });
    saveDemoWorks(works);
    return { workId };
  }

  const work = await apiFetch<WorkResponse>('/api/v1/works', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      genre: input.genre,
      description: input.description?.trim() || null,
    }),
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
