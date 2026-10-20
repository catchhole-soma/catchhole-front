import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronDown, FileText, RefreshCw } from 'lucide-react';
import { getCharacterFactEvidenceOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { RelationshipEvidenceResponse } from '../../../api/generated/types.gen';
import { analysisSourceLabel } from '../../../lib/analysis-source';
import { CharacterEvidencePanel } from '../character/CharacterEvidencePanel';
import { ActionButton } from '../ui-v2/ActionButton';
import { WorldSettingDialog } from '../worldsetting/WorldSettingDialog';
import { currentSettingText, relationshipError } from './relationship-presentation';
import '../../../../styles/family-evidence.css';

type RelationshipEvidenceProps = {
  workId: string;
  evidence: RelationshipEvidenceResponse[];
  onOpen: (factId: string) => void;
  characterNames?: Record<string, string>;
  showSettings?: boolean;
};

export function RelationshipEvidence({ evidence, onOpen, characterNames, workId, showSettings = true }: RelationshipEvidenceProps) {
  return <div className="relationship-evidence-list relationship-evidence-list--flat" aria-label={showSettings ? '관계의 바탕이 된 설정' : '관계의 원문 근거'}>
    {evidence.length === 0 && <p className="relationship-muted">연결된 설정 근거가 없어요.</p>}
    {evidence.map((source, index) => {
      const owner = source.characterId ? characterNames?.[source.characterId] : undefined;
      return <section className="relationship-evidence" key={`${source.sourceFactId}-${source.sourceToken}-${index}`}>
        {showSettings ? <div className="relationship-evidence__heading">
          <strong>{owner ? `${owner}의 가족 설정` : source.current ? '현재 프로필' : '이전 설정 근거'}</strong>
          {owner && <span>{source.current ? '현재 프로필' : '이전 설정 근거'}</span>}
          {(source.manuallyEdited || !owner) && <span>{source.manuallyEdited ? '직접 수정한 설정' : '확정된 설정'}</span>}
        </div> : (owner || source.manuallyEdited) && <div className="relationship-evidence__heading">
          {owner && <strong>{owner}의 원문 근거</strong>}
          {source.manuallyEdited && <span>직접 수정한 설정</span>}
        </div>}
        {showSettings && source.currentValue != null && <RelationshipCurrentSetting value={source.currentValue} />}
        {!source.current && <p className="relationship-muted">현재 설정이 바뀌었거나 인물이 보관되었어요. 이전 근거를 확인할 수 있어요.</p>}
        {source.hasEvidence && source.sourceFactId
          ? <RelationshipOriginalQuotes workId={workId} factId={source.sourceFactId} index={index} onOpen={onOpen} />
          : <span className="relationship-muted">조회할 수 있는 원문 근거가 없어요.</span>}
      </section>;
    })}
  </div>;
}

/** Native details hide children without unmounting them, so mount original reads only while open. */
export function RelationshipEvidenceDisclosure({ summary, ...props }: Omit<RelationshipEvidenceProps, 'showSettings'> & { summary: string }) {
  const [open, setOpen] = useState(false);
  return <details className="review-cb-evidence family-evidence-disclosure" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><BookOpen size={14} aria-hidden="true" />{summary}</span>
      <span className="review-cb-evidence__button"><span className="when-closed">펼치기</span><span className="when-open">접기</span><ChevronDown size={14} aria-hidden="true" /></span>
    </summary>
    {open && <div className="review-cb-evidence__body"><RelationshipEvidence {...props} showSettings={false} /></div>}
  </details>;
}

/** The containing relationship detail or source disclosure decides when to mount original reads. */
function RelationshipOriginalQuotes({ workId, factId, index, onOpen }: {
  workId: string; factId: string; index: number; onOpen: (factId: string) => void;
}) {
  const query = useQuery(getCharacterFactEvidenceOptions({ path: { workId, characterFactId: factId } }));
  if (query.isPending) return <p className="family-evidence-original__status" role="status">원문 인용을 불러오고 있어요.</p>;
  // Do not present previously cached quotations after the server denies or fails the read.
  if (query.isError) return <div className="family-evidence-original__error" role="alert">
    <p>{relationshipError(query.error, '원문 인용을 불러오지 못했어요. 다시 시도해 주세요.')}</p>
    <button type="button" className="family-evidence-original__link" disabled={query.isFetching}
      onClick={() => void query.refetch()}><RefreshCw size={14} aria-hidden="true" />인용문 다시 불러오기</button>
  </div>;

  const original = query.data?.data;
  const spans = original?.evidenceSpans.filter(span => span.quote.trim().length > 0) ?? [];
  const label = analysisSourceLabel(original?.source, original?.episode?.episodeNo);
  const title = original?.source?.sourceKind !== 'SETTING_BOOK' ? original?.episode?.title : null;
  return <div className="family-evidence-original">
    <div className="family-evidence-original__source"><span>원문</span><span>{label}</span>{title && <span>{title}</span>}</div>
    {spans.length > 0 ? <>
      {spans.map((span, position) => <blockquote className="family-evidence-original__quote" key={`${span.startOffset}-${span.endOffset}-${position}`}>
        {span.quote}
      </blockquote>)}
      {original?.content == null && <p className="family-evidence-original__status">저장된 인용문이에요. 전체 원문은 현재 확인할 수 없어요.</p>}
    </> : <p className="family-evidence-original__status">저장된 인용문이 없어요.</p>}
    {(spans.length > 0 || original?.content != null) && <button type="button" className="family-evidence-original__link" aria-label={`원문 근거 ${index + 1}`}
      onClick={() => onOpen(factId)}><FileText size={14} aria-hidden="true" />{original?.content != null ? '전체 원문 보기' : '근거 상세 보기'}</button>}
  </div>;
}

function settingPart(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/** Keep both representations visible when the server held a conflicting current slot. */
export function RelationshipCurrentSetting({ value }: { value: unknown }) {
  const wrapper = value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const display = currentSettingText(value);
  const structured = wrapper?.valueJson;
  const attributes = structured != null && typeof structured === 'object' && !Array.isArray(structured)
    ? structured as Record<string, unknown> : null;
  const detail = settingPart(attributes ? attributes.value : structured);
  const extra = attributes ? Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== 'value')) : null;
  const conflicting = display != null && detail != null && display !== detail;
  return <div className="relationship-current-setting">
    {conflicting ? <><p className="relationship-value"><strong>표시된 설정</strong><br />{display}</p>
      <p className="relationship-value"><strong>세부 설정</strong><br />{detail}</p></>
      : <p className="relationship-value">{display ?? detail ?? '설정 내용을 확인할 수 없어요.'}</p>}
    {extra && Object.keys(extra).length > 0 && <details className="relationship-setting-attributes">
      <summary>설정의 추가 속성 확인</summary><pre>{JSON.stringify(extra, null, 2)}</pre>
    </details>}
  </div>;
}

export function RelationshipEvidenceDialog({ workId, factId, onClose }: {
  workId: string; factId: string; onClose: () => void;
}) {
  const query = useQuery(getCharacterFactEvidenceOptions({ path: { workId, characterFactId: factId } }));
  return <WorldSettingDialog title="가족 관계의 원문 근거" onClose={onClose} className="relationship-evidence-dialog">
    <CharacterEvidencePanel evidence={query.data?.data ?? null} loading={query.isPending}
      error={query.isError ? relationshipError(query.error, '원문 근거를 불러오지 못했어요. 다시 시도해 주세요.') : null}
      onRetry={() => void query.refetch()} onClose={onClose} />
  </WorldSettingDialog>;
}

export function RelationshipQueryError({ title, onRetry, pending = false }: {
  title: string; onRetry: () => void; pending?: boolean;
}) {
  return <div className="relationship-notice relationship-notice--error" role="alert">
    <p>{title}</p>
    <ActionButton variant="secondary" size="compact" disabled={pending} icon={<RefreshCw size={15} aria-hidden="true" />}
      onClick={onRetry}>다시 불러오기</ActionButton>
  </div>;
}
