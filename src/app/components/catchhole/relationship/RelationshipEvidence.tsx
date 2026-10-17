import { useQuery } from '@tanstack/react-query';
import { FileText, RefreshCw } from 'lucide-react';
import { getCharacterFactEvidenceOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { RelationshipEvidenceResponse } from '../../../api/generated/types.gen';
import { CharacterEvidencePanel } from '../character/CharacterEvidencePanel';
import { ActionButton } from '../ui-v2/ActionButton';
import { WorldSettingDialog } from '../worldsetting/WorldSettingDialog';
import { currentSettingText, relationshipError } from './relationship-presentation';

export function RelationshipEvidence({ evidence, onOpen }: {
  evidence: RelationshipEvidenceResponse[];
  onOpen: (factId: string) => void;
}) {
  return <div className="relationship-evidence-list" aria-label="관계의 바탕이 된 설정">
    {evidence.length === 0 && <p className="relationship-muted">연결된 설정 근거가 없어요.</p>}
    {evidence.map((source, index) => {
      return <section className="relationship-evidence" key={`${source.sourceFactId}-${source.sourceToken}-${index}`}>
        <div className="relationship-evidence__heading">
          <strong>{source.current ? '현재 프로필' : '이전 설정 근거'}</strong>
          <span>{source.manuallyEdited ? '직접 수정한 설정' : '확정된 설정'}</span>
        </div>
        {source.currentValue != null && <RelationshipCurrentSetting value={source.currentValue} />}
        {!source.current && <p className="relationship-muted">현재 설정이 바뀌었거나 인물이 보관되었어요. 이전 근거를 확인할 수 있어요.</p>}
        {source.hasEvidence && source.sourceFactId
          ? <ActionButton variant="secondary" size="compact" icon={<FileText size={15} aria-hidden="true" />}
            onClick={() => onOpen(source.sourceFactId!)}>원문 근거 {index + 1}</ActionButton>
          : <span className="relationship-muted">조회할 수 있는 원문 근거가 없어요.</span>}
      </section>;
    })}
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
