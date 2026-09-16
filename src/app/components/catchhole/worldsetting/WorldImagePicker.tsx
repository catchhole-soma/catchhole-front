import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Search } from 'lucide-react';
import { getWorldImageCatalogOptions, updateWorldSettingImageMutation } from '../../../api/generated/@tanstack/react-query.gen';
import type { WorldImageCatalogResponse, WorldSettingDetailResponse } from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { PageNavigation } from '../PageNavigation';
import { WorldSettingDialog } from './WorldSettingDialog';
import { WorldSubjectImage } from './WorldSubjectImage';
import { PrivateImageVaultGate } from './PrivateImageVaultGate';
import { PrivateWorldImagePicker } from './PrivateWorldImagePicker';

export function WorldImagePicker({ workId, detail, onClose, onSaved, onReload }: {
  workId: string;
  detail: WorldSettingDetailResponse;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onReload: () => Promise<number>;
}) {
  const [tab, setTab] = useState<'catalog' | 'private'>(detail.image?.source === 'PRIVATE' ? 'private' : 'catalog');
  const [privateBusy, setPrivateBusy] = useState(false);
  const [privateId, setPrivateId] = useState<string | undefined>(detail.image?.privateImageId ?? undefined);
  const [search, setSearch] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(detail.image?.version ?? 0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [reloadPending, setReloadPending] = useState(false);
  const [reloadError, setReloadError] = useState(false);
  const [selection, setSelection] = useState<WorldImageCatalogResponse | null>(() => detail.image?.source === 'MANUAL'
    ? { id: detail.image.catalogId ?? undefined, name: detail.image.name ?? undefined, thumbnailUrl: detail.image.thumbnailUrl ?? undefined, imageUrl: detail.image.imageUrl ?? undefined }
    : null);
  const catalog = useQuery({
    ...getWorldImageCatalogOptions({ query: { category: detail.category ?? 'RACE', q: query, page, size: 18 } }),
    enabled: tab === 'catalog',
    retry: shouldRetryQuery,
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    ...updateWorldSettingImageMutation(),
    onSuccess: async () => { await onSaved(); onClose(); },
  });
  const error = toApiError(mutation.error);
  const conflict = error?.status === 409;
  const pending = mutation.isPending || reloadPending || privateBusy;
  const entries = catalog.data?.data;
  const changed = (privateId ?? null) !== (detail.image?.privateImageId ?? null) || (selection?.id ?? null) !== (detail.image?.source === 'MANUAL' ? detail.image.catalogId : null);
  return <WorldSettingDialog title="대표 이미지 선택" description={`${detail.subjectName ?? '대상'}에 사용할 이미지를 골라 주세요. 작품의 설정 내용은 바뀌지 않아요.`}
    className="world-image-picker" onClose={onClose} pending={pending}>
    <div className="world-image-picker__body">
      <div className="private-image-tabs" role="group" aria-label="이미지 보관함 선택">
        <button className="database-button" aria-pressed={tab === 'catalog'} disabled={pending} onClick={() => setTab('catalog')}>공용 도감</button>
        <button className="database-button" aria-pressed={tab === 'private'} disabled={pending} onClick={() => setTab('private')}>내 이미지</button>
      </div>
      {tab === 'private' ? <PrivateImageVaultGate onBusy={setPrivateBusy} pending={pending}>
        {(vaultId, key) => <PrivateWorldImagePicker workId={workId} vaultId={vaultId} vaultKey={key} selectedId={privateId}
          pending={pending} onBusy={setPrivateBusy} onSelect={image => { setPrivateId(image?.id); setSelection(null); }} />}
      </PrivateImageVaultGate> : <>
      <form className="world-image-picker__search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}>
        <Search size={17} aria-hidden="true" />
        <input aria-label="대표 이미지 이름·별칭 검색" value={search} maxLength={100} placeholder="이름·별칭으로 찾기"
          onChange={event => setSearch(event.target.value)} />
        <button className="database-button" type="submit">검색</button>
      </form>
      <button type="button" className="world-image-picker__default" aria-pressed={!selection && !privateId} onClick={() => { setSelection(null); setPrivateId(undefined); }} disabled={pending}>
        <WorldSubjectImage category={detail.category} />
        <span><strong>분류 기본 이미지</strong><small>아직 어울리는 이미지가 없다면</small></span>
        {!selection && !privateId && <Check size={18} aria-hidden="true" />}
      </button>
      {catalog.isPending ? <p role="status"><Loader2 size={16} className="spin" /> 이미지를 불러오고 있어요.</p>
        : catalog.isError ? <div role="alert" className="world-image-picker__error"><p>도감을 불러오지 못했어요.</p>
          <button className="database-button" onClick={() => void catalog.refetch()}>다시 시도</button></div>
          : <>
            <div className="world-image-picker__grid" aria-label="대표 이미지 도감">
              {entries?.content?.map(entry => <button key={entry.id} type="button" className="world-image-picker__option"
                aria-label={`${entry.name} 이미지 선택`} aria-pressed={selection?.id === entry.id} disabled={pending} onClick={() => { setSelection(entry); setPrivateId(undefined); }}>
                <WorldSubjectImage category={detail.category} path={entry.thumbnailUrl} />
                <span>{entry.name}{selection?.id === entry.id && <Check size={15} aria-hidden="true" />}</span>
              </button>)}
            </div>
            {!entries?.content?.length && <p className="world-image-picker__empty">검색 결과가 없어요. 다른 별칭을 입력하거나 기본 이미지를 사용해 주세요.</p>}
            <PageNavigation page={page} totalPages={entries?.totalPages ?? 0} disabled={catalog.isFetching || pending}
              onPageChange={setPage} />
          </>}
      </>}
      <div className="world-image-picker__footer">
        <div className="world-image-picker__selection" aria-live="polite"><ImagePlus size={16} aria-hidden="true" />{privateId ? '내 이미지' : selection?.name ?? '분류 기본 이미지'} 선택</div>
        {mutation.isError && <div role="alert" className="world-image-picker__error">
          <p>{error?.message ?? '이미지를 저장하지 못했어요. 선택은 유지되어 있으니 다시 시도해 주세요.'}</p>
          {conflict && <button className="database-button" disabled={pending} onClick={async () => {
            setReloadPending(true); setReloadError(false);
            try { setExpectedVersion(await onReload()); mutation.reset(); } catch { setReloadError(true); } finally { setReloadPending(false); }
          }}>최신 이미지 확인</button>}
          {reloadError && <p>최신 이미지를 불러오지 못했어요. 다시 시도해 주세요.</p>}
        </div>}
        <div className="world-image-picker__actions">
          <button className="database-button" disabled={pending} onClick={onClose}>취소</button>
          <button className="database-button is-primary" disabled={pending || conflict || !changed} onClick={() => mutation.mutate({
            path: { workId, worldSettingId: detail.id! }, body: { catalogId: selection?.id ?? null, privateImageId: privateId ?? null, version: expectedVersion },
          })}>{mutation.isPending ? '저장 중…' : '이미지 저장'}</button>
        </div>
      </div>
    </div>
  </WorldSettingDialog>;
}
