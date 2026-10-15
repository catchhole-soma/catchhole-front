import { validSettingBookReference, type SettingBookReferenceKind } from '../../lib/setting-book-reference';

export function SettingBookReferenceFields({ idPrefix, kind, episodeNo, disabled, onKindChange, onEpisodeNoChange }: {
  idPrefix: string; kind: SettingBookReferenceKind; episodeNo: string; disabled: boolean;
  onKindChange: (kind: SettingBookReferenceKind) => void; onEpisodeNoChange: (value: string) => void;
}) {
  return <details className="setting-book-reference">
    <summary>설정집 기준 시점 (선택)</summary>
    <fieldset className="episode-analysis-mode setting-book-reference-fields" disabled={disabled}>
    <legend>설정집 기준 시점 (선택)</legend>
    <label htmlFor={`${idPrefix}-reference-kind`}>어느 시점의 설정인가요?</label>
    <select id={`${idPrefix}-reference-kind`} value={kind}
      onChange={event => onKindChange(event.target.value as SettingBookReferenceKind)}>
      <option value="UNSPECIFIED">미지정</option>
      <option value="WORK_START">작품 시작 시점</option>
      <option value="EPISODE">특정 회차 기준</option>
    </select>
    {kind === 'EPISODE' && <>
      <label htmlFor={`${idPrefix}-reference-episode`}>기준 회차</label>
      <input id={`${idPrefix}-reference-episode`} type="number" min="1" max="2147483647" step="1" inputMode="numeric"
        value={episodeNo} onChange={event => onEpisodeNoChange(event.target.value)} placeholder="예: 25" />
      <p>{validSettingBookReference(kind, episodeNo) ? `${Number(episodeNo)}화 종료 시점의 설정으로 참고합니다.` : '1 이상의 회차 번호를 입력해 주세요.'}</p>
    </>}
    {kind !== 'EPISODE' && <p>시점을 모르면 미지정으로 두세요.</p>}
    </fieldset>
  </details>;
}
