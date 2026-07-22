export const WORK_GENRES = ['로맨스', '판타지', '무협', '현대', '미스터리', '기타'] as const;

export type WorkGenre = typeof WORK_GENRES[number];

export interface SelectedWorkInfo {
  id: string;
  title: string;
  genre: string;
}
