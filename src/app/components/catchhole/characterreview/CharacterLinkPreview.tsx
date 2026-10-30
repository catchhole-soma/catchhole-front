import { useQuery } from '@tanstack/react-query';
import { getCharacterOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { SettingCandidateResponse } from '../../../api/generated/types.gen';
import { analysisSourceLabel } from '../../../lib/analysis-source';
import { useCharacterSettingLabels } from '../character/CharacterSettingLabelProvider';
import { errorMessage, existingCharacterSettingValue, toSettingDisplay } from './characterReviewFormat';

/** 미리보기에 펼칠 최대 설정 수. 나머지는 개수만 알린다. */
const PREVIEW_SETTING_LIMIT = 6;
const PROFILE_PREVIEW_LIMIT = 3;

/**
 * 연결할 인물의 저장된 현재 설정과, 연결하려는 설정이 그 인물에 이미 있는지 보여 준다.
 * 서버가 비교한 결과가 아니므로 `현재값과 비교`처럼 단정하지 않고 `대상에 저장된 현재 설정`으로만 부른다.
 * 상세를 읽지 못하면 `기존값 없음`과 다른 문장·role로 알린다.
 */
export function CharacterLinkPreview({ workId, characterId, candidates }: {
  workId: string;
  characterId: string | null;
  candidates: SettingCandidateResponse[];
}) {
  const labels = useCharacterSettingLabels();
  const detailQuery = useQuery({
    ...getCharacterOptions({ path: { workId, characterId: characterId ?? '' } }),
    enabled: Boolean(workId && characterId),
  });
  const settings = candidates.filter(candidate => candidate.candidateKind !== 'CHARACTER_DISCOVERY');
  const multiple = settings.length > 1;

  if (!characterId) {
    return <aside className="review-link-preview is-empty" aria-label="연결 미리보기">
      <p>인물을 고르면 그 인물에 저장된 현재 설정을 여기에서 볼 수 있어요.</p>
    </aside>;
  }
  if (detailQuery.isPending) {
    return <aside className="review-link-preview" aria-label="연결 미리보기" aria-busy="true">
      <p role="status">인물 정보를 불러오고 있어요.</p>
    </aside>;
  }
  if (detailQuery.isError || !detailQuery.data?.data) {
    return <aside className="review-link-preview is-error" aria-label="연결 미리보기">
      <div role="alert">
        <strong>비교 정보를 불러오지 못했어요</strong>
        <p>{errorMessage(detailQuery.error, '잠시 후 다시 시도해 주세요.')} 기존값이 없다는 뜻은 아니에요. 연결은 그대로 진행할 수 있어요.</p>
      </div>
      <button type="button" className="review-cb-secondary" disabled={detailQuery.isFetching}
        onClick={() => void detailQuery.refetch()}>다시 시도</button>
    </aside>;
  }

  const detail = detailQuery.data.data;
  const facts = [
    detail.roleLabel?.trim() || null,
    detail.firstAppearanceEpisode?.episodeNo == null ? '첫 등장 정보 없음' : `첫 등장 ${detail.firstAppearanceEpisode.episodeNo}화`,
    detail.currentAge == null ? null : `나이 ${detail.currentAge}`,
    detail.currentLevel == null ? null : `레벨 ${detail.currentLevel}`,
  ].filter((fact): fact is string => Boolean(fact));
  const profile = (detail.profile ?? []).filter(setting => setting.value?.trim()).slice(0, PROFILE_PREVIEW_LIMIT);
  const shown = settings.slice(0, PREVIEW_SETTING_LIMIT);

  return <aside className="review-link-preview" aria-label="연결 미리보기">
    <div className="review-link-preview__identity">
      <small>선택한 인물</small>
      <strong>{detail.name || '이름 없는 인물'}</strong>
      <span>{facts.join(' · ')}</span>
    </div>
    <section className="review-link-preview__section" aria-label="대상에 저장된 현재 설정">
      <h3>대상에 저장된 현재 설정</h3>
      {profile.length ? <dl>{profile.map(setting => <div key={setting.key ?? setting.displayName}>
        <dt>{setting.displayName || setting.key}</dt><dd>{setting.value}</dd>
      </div>)}</dl> : <p className="review-link-preview__muted">저장된 프로필 설정이 없어요.</p>}
    </section>
    {shown.length > 0 && <section className="review-link-preview__section" aria-label="이 설정의 기존값">
      <h3>이 설정의 기존값</h3>
      <dl>{shown.map(candidate => {
        const value = existingCharacterSettingValue(detail, candidate);
        const name = toSettingDisplay(candidate.attributeName, candidate.attributeDisplayName, labels).nameLabel;
        return <div key={candidate.id} className={value == null ? 'is-missing' : undefined}>
          <dt>{multiple ? `${name} · ${analysisSourceLabel(candidate.source, candidate.episodeNo)}` : name}</dt>
          <dd>{value ?? '기존값 없음'}</dd>
        </div>;
      })}</dl>
      {settings.length > shown.length && <p className="review-link-preview__muted">외 {settings.length - shown.length}개 설정</p>}
      <p className="review-link-preview__muted">연결한 뒤 비교 결과에서 반영 방식을 정해요.</p>
    </section>}
  </aside>;
}
