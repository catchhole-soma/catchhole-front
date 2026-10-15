import type { SettingBookResponse } from '../api/generated/types.gen';

export type SettingBookReferenceKind = NonNullable<SettingBookResponse['referenceTimeKind']>;

export function settingBookReferenceLabel(kind: SettingBookReferenceKind = 'UNSPECIFIED', episodeNo?: number | null): string {
  return kind === 'WORK_START' ? '작품 시작 시점 기준'
    : kind === 'EPISODE' && episodeNo != null ? `${episodeNo}화 종료 시점 기준` : '기준 시점 미지정';
}

export function validSettingBookReference(kind: SettingBookReferenceKind, episodeNo: string): boolean {
  const number = Number(episodeNo);
  return kind !== 'EPISODE' || Number.isInteger(number) && number > 0 && number <= 2_147_483_647;
}
