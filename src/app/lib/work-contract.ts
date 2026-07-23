export const WORK_GENRES = [
  '판타지',
  '로맨스',
  '추리',
  '코미디',
  'SF',
  '스포츠',
  '호러',
  '무협',
  '일상',
  '기타',
] as const;

export type WorkGenre = typeof WORK_GENRES[number];

export interface SelectedWorkInfo {
  id: string;
  title: string;
  genre: string;
}
