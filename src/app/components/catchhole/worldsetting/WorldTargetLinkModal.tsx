import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorldSettingOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { WorldSettingCandidateResponse } from '../../../api/generated/types.gen';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { ActionButton, ModalLayer } from '../characterreview/ReviewModalControls';
import { useWorldTargetSearch } from './useWorldTargetSearch';
import { NEW_WORLD_TARGET_ID, WorldTargetPicker } from './WorldTargetPicker';
import {
  planWorldTargetLink, worldPropertyPathKey,
  type WorldLinkTarget, type WorldTargetLinkOutcome, type WorldTargetLinkUnit,
} from './worldReviewDecisions';

type WorldCategory = NonNullable<WorldSettingCandidateResponse['category']>;

const PREVIEW_PROPERTY_LIMIT = 5;

const OUTCOME_TEXT: Record<WorldTargetLinkOutcome, string> = {
  add: '기존값 없음 → 추가로 저장',
  existing: '기존값 있음 → 병합/교체 결정 필요',
  conflict: '원문 내용이 서로 달라요 → 최종 내용 결정 필요',
  duplicate: '함께 고른 설정과 위치가 같아요 → 내용 결정 필요',
};

function pathLabel(scopeName?: string | null, settingName?: string | null): string {
  return scopeName?.trim() ? `${scopeName.trim()} › ${settingName ?? ''}` : settingName ?? '설정명 없음';
}

/**
 * 고른 대상에 저장된 설정과, 체크한 각 설정이 어떻게 저장될지 보여 준다. 대상에 같은 위치의 설정이 있으면
 * 저장하지 않고 결정으로 남긴다는 사실을 먼저 알린다. 대상 정보를 읽지 못하면 저장 방법을 추측하지 않는다.
 */
function WorldTargetPreview({ selectedId, newTarget, detailQuery, categoryLabels, rows }: {
  selectedId: string | null;
  newTarget: WorldLinkTarget | null;
  detailQuery: ReturnType<typeof useWorldTargetDetail>;
  categoryLabels: Record<WorldCategory, string>;
  rows: Array<{ unit: WorldTargetLinkUnit; outcome: WorldTargetLinkOutcome }> | null;
}) {
  if (!selectedId) {
    return <aside className="review-link-preview is-empty" aria-label="연결 미리보기">
      <p>대상을 고르면 그 대상에 저장된 설정과 체크한 설정의 저장 방법을 여기에서 볼 수 있어요.</p>
    </aside>;
  }
  const outcomes = rows && <section className="review-link-preview__section" aria-label="체크한 설정의 저장 방법">
    <h3>체크한 설정의 저장 방법</h3>
    <dl>{rows.map(({ unit, outcome }) => <div key={unit.candidateIds.join(',')} className={outcome === 'add' ? undefined : 'is-decision'}>
      <dt>{pathLabel(unit.draft.scopeName, unit.draft.settingName)}</dt>
      <dd>{selectedId === NEW_WORLD_TARGET_ID && outcome === 'add' ? '새 대상 → 추가로 저장' : OUTCOME_TEXT[outcome]}</dd>
    </div>)}</dl>
  </section>;
  if (selectedId === NEW_WORLD_TARGET_ID) {
    return <aside className="review-link-preview" aria-label="연결 미리보기">
      <div className="review-link-preview__identity">
        <small>새로 등록할 대상</small>
        <strong>{newTarget?.subjectName || '이름을 입력해 주세요'}</strong>
        {newTarget && <span>{categoryLabels[newTarget.category]} · 저장된 설정 없음</span>}
      </div>
      {outcomes}
    </aside>;
  }
  if (detailQuery.isPending) {
    return <aside className="review-link-preview" aria-label="연결 미리보기" aria-busy="true">
      <p role="status">대상 정보를 불러오고 있어요.</p>
    </aside>;
  }
  const detail = detailQuery.data?.data;
  if (detailQuery.isError || !detail || detail.id !== selectedId) {
    return <aside className="review-link-preview is-error" aria-label="연결 미리보기">
      <div role="alert">
        <strong>대상 정보를 불러오지 못했어요</strong>
        <p>같은 설정이 있는지 확인하지 못해 아직 저장할 수 없어요.</p>
      </div>
      <button type="button" className="review-cb-secondary" disabled={detailQuery.isFetching}
        onClick={() => void detailQuery.refetch()}>다시 시도</button>
    </aside>;
  }
  const properties = (detail.properties ?? []).slice(0, PREVIEW_PROPERTY_LIMIT);
  return <aside className="review-link-preview" aria-label="연결 미리보기">
    <div className="review-link-preview__identity">
      <small>{detail.category ? categoryLabels[detail.category] : '세계관'}</small>
      <strong>{detail.subjectName || '이름 없는 대상'}</strong>
      <span>설정 {detail.propertyCount ?? detail.properties?.length ?? 0}개</span>
    </div>
    <section className="review-link-preview__section" aria-label="대상에 저장된 현재 설정">
      <h3>대상에 저장된 현재 설정</h3>
      {properties.length ? <dl>{properties.map((property, index) => <div key={`${property.scopeName ?? ''}-${property.settingName}-${index}`}>
        <dt>{pathLabel(property.scopeName, property.settingName)}</dt><dd>{property.value}</dd>
      </div>)}</dl> : <p className="review-link-preview__muted">저장된 설정이 없어요.</p>}
    </section>
    {outcomes}
  </aside>;
}

function useWorldTargetDetail(workId: string, selectedId: string | null) {
  return useQuery({
    ...getWorldSettingOptions({ path: { workId, worldSettingId: selectedId ?? '' } }),
    enabled: Boolean(workId && selectedId && selectedId !== NEW_WORLD_TARGET_ID),
    retry: shouldRetryQuery,
  });
}

/**
 * 묶음에서 체크한 세계관 설정을 하나의 대상에 연결한다. 대상은 실제 등록된 대상 검색 또는 새 대상 이름으로만 고른다.
 * 저장할 행(대상에 같은 위치가 없는 행)과 결정으로 남길 행을 미리 보여 주고, 적용은 부모가 한 번의 결정 저장으로 처리한다.
 */
export function WorldTargetLinkModal({ workId, units, groupCategory, groupSubjectName, categoryLabels, pending, error, onClose, onApply }: {
  workId: string;
  units: WorldTargetLinkUnit[];
  groupCategory?: WorldCategory;
  groupSubjectName?: string;
  categoryLabels: Record<WorldCategory, string>;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onApply: (target: WorldLinkTarget, plan: ReturnType<typeof planWorldTargetLink>) => void;
}) {
  const search = useWorldTargetSearch({ workId, category: groupCategory, enabled: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState(groupSubjectName ?? '');
  const detailQuery = useWorldTargetDetail(workId, selectedId);
  const detail = detailQuery.data?.data;
  const isNew = selectedId === NEW_WORLD_TARGET_ID;
  const target: WorldLinkTarget | null = isNew
    ? newName.trim() && search.category ? { worldSettingId: null, category: search.category, subjectName: newName.trim() } : null
    : detail && detail.id === selectedId && detail.category && detail.subjectName && !detailQuery.isError
      ? { worldSettingId: detail.id, category: detail.category, subjectName: detail.subjectName } : null;
  const existingPaths = useMemo(() => new Set((isNew ? [] : detail?.properties ?? [])
    .map(property => worldPropertyPathKey(property.scopeName, property.settingName))), [detail?.properties, isNew]);
  const plan = target ? planWorldTargetLink(units, target, existingPaths) : null;
  const categoryLabel = search.category ? categoryLabels[search.category] : '세계관';
  const saveCount = plan?.rows.filter(row => row.outcome === 'add').reduce((count, row) => count + row.unit.candidateIds.length, 0) ?? 0;
  const decisionCount = plan?.pending.length ?? 0;

  return <ModalLayer title="선택 항목 대상 연결" width={900} pending={pending} onClose={onClose}
    description={`체크한 설정 ${units.reduce((count, unit) => count + unit.candidateIds.length, 0)}개를 하나의 세계관 대상에 연결합니다. 대상에 같은 설정이 있는 항목은 저장하지 않고 각 설정에서 결정하도록 남겨요.`}>
    <div className="review-match-summary" role="group" aria-label="연결할 설정">
      <strong>선택 {units.length}개</strong>
      <span>{units.map(unit => pathLabel(unit.draft.scopeName, unit.draft.settingName)).join(', ')}</span>
    </div>
    <div className="review-match-layout">
      <div className="review-match-search">
        <WorldTargetPicker search={search} label="어느 대상에 연결할까요?" categoryLabel={categoryLabel}
          value={selectedId} disabled={pending} searchLabel="연결할 세계관 대상 검색"
          controls={<label>분류<select aria-label="연결할 대상의 분류" value={search.category ?? ''} disabled={pending}
            onChange={event => { search.setCategory((event.target.value || undefined) as WorldCategory | undefined); setSelectedId(null); }}>
            {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>}
          newTarget={{ title: '새 대상으로 등록', description: `기존 ${categoryLabel} 항목과 별개라면 이름을 정해 새로 등록해요.`, footnote: '확정할 때 등록' }}
          onChange={setSelectedId}>
          {isNew && <label className="review-target-link__name">새 대상 이름<input aria-label="새 대상 이름" value={newName} disabled={pending}
            onChange={event => setNewName(event.target.value)} /></label>}
        </WorldTargetPicker>
      </div>
      <WorldTargetPreview selectedId={selectedId} newTarget={isNew ? target : null} detailQuery={detailQuery}
        categoryLabels={categoryLabels} rows={plan?.rows ?? null} />
    </div>
    {plan && <p className="review-target-link__plan" role="status">
      {saveCount > 0 ? `${saveCount}개는 ‘${target!.subjectName}’에 추가로 저장해요.` : '추가로 저장할 설정이 없어요.'}
      {decisionCount > 0 ? ` ${decisionCount}개는 저장하지 않고 각 설정에서 병합·교체·최종 내용을 정하도록 남겨요.` : ''}
    </p>}
    {error && <div role="alert" className="review-match-state is-error" style={{ marginTop: 14 }}>{error}</div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
      <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
      <ActionButton tone={C.primary} disabled={pending || !plan || !target}
        disabledTitle={!target ? isNew ? '새 대상 이름을 입력해 주세요.' : '연결할 대상을 고르고 정보를 불러온 뒤 적용할 수 있어요.' : undefined}
        onClick={() => { if (target && plan) onApply(target, plan); }}>
        {pending ? '저장 중…' : '고른 대상에 연결'}
      </ActionButton>
    </div>
  </ModalLayer>;
}
