import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Search } from 'lucide-react';
import { getWorldImageCatalogOptions, updateWorldSettingImageMutation, updateCharacterImageMutation } from '../../../api/generated/@tanstack/react-query.gen';
import type { CharacterDetailResponse, CharacterImageUpdateRequest, WorldImageCatalogResponse, WorldSettingDetailResponse, WorldSettingImageResponse } from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { PageNavigation } from '../PageNavigation';
import { WorldSettingDialog } from './WorldSettingDialog';
import { WorldSubjectImage } from './WorldSubjectImage';
import { PrivateImageVaultGate } from './PrivateImageVaultGate';
import { PrivateWorldImagePicker } from './PrivateWorldImagePicker';
import { CHARACTER_DEFAULT_IMAGE } from '../character/CharacterSubjectImage';

type PickerCallbacks = {
  onClose: () => void;
  onSaved: () => Promise<void>;
  onReload: () => Promise<number>;
};

export function WorldImagePicker({ workId, detail, ...callbacks }: PickerCallbacks & {
  workId: string; detail: WorldSettingDetailResponse;
}) {
  const mutation = useMutation(updateWorldSettingImageMutation());
  return <SubjectImagePicker {...callbacks} workId={workId} name={detail.subjectName ?? '대상'} category={detail.category ?? 'RACE'} image={detail.image}
    saveImage={({ catalogId, privateImageId, version, useDefault }) => mutation.mutateAsync({ path: { workId, worldSettingId: detail.id! }, body: { catalogId, privateImageId, version, useAutomatic: !useDefault && !catalogId && !privateImageId ? true : undefined } })} />;
}

export function CharacterImagePicker({ workId, detail, ...callbacks }: PickerCallbacks & {
  workId: string; detail: CharacterDetailResponse;
}) {
  const mutation = useMutation(updateCharacterImageMutation());
  return <SubjectImagePicker {...callbacks} workId={workId} name={detail.name ?? '캐릭터'} category="RACE" image={detail.image} character
    saveImage={body => mutation.mutateAsync({ path: { workId, characterId: detail.id! }, body })} />;
}

function SubjectImagePicker({ workId, name, category, image, character = false, saveImage, onClose, onSaved, onReload }: PickerCallbacks & {
  workId: string; name: string; category: NonNullable<WorldSettingDetailResponse['category']>;
  image?: WorldSettingImageResponse; character?: boolean; saveImage: (body: CharacterImageUpdateRequest) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<'catalog' | 'private'>(image?.source === 'PRIVATE' ? 'private' : 'catalog');
  const [useDefault, setUseDefault] = useState(image?.source === 'DEFAULT');
  const [privateBusy, setPrivateBusy] = useState(false);
  const [privateId, setPrivateId] = useState<string | undefined>(image?.privateImageId ?? undefined);
  const [search, setSearch] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(image?.version ?? 0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [recommended, setRecommended] = useState(!character);
  const [reloadPending, setReloadPending] = useState(false);
  const [reloadError, setReloadError] = useState(false);
  const [selection, setSelection] = useState<WorldImageCatalogResponse | null>(() => image?.source === 'MANUAL'
    ? { id: image.catalogId ?? undefined, name: image.name ?? undefined, thumbnailUrl: image.thumbnailUrl ?? undefined, imageUrl: image.imageUrl ?? undefined }
    : null);
  const catalog = useQuery({
    ...getWorldImageCatalogOptions({ query: { category, q: query, page, size: 18, ...(character ? {} : { workId, recommended }) } }),
    enabled: tab === 'catalog',
    retry: shouldRetryQuery,
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: saveImage,
    onSuccess: async () => { await onSaved(); onClose(); },
  });
  const error = toApiError(mutation.error);
  const conflict = error?.status === 409;
  const pending = mutation.isPending || reloadPending || privateBusy;
  const entries = catalog.data?.data;
  const changed = useDefault !== (image?.source === 'DEFAULT') || (privateId ?? null) !== (image?.privateImageId ?? null) || (selection?.id ?? null) !== (image?.source === 'MANUAL' ? image.catalogId : null);
  return <WorldSettingDialog title="대표 이미지 선택" description={`${name}에 사용할 이미지를 골라 주세요. 공용 그림은 예시이며, 작품의 설정 내용은 바뀌지 않아요.`}
    className="world-image-picker" onClose={onClose} pending={pending}>
    <div className="world-image-picker__body">
      <div className="private-image-tabs" role="group" aria-label="이미지 보관함 선택">
        <button className="database-button" aria-pressed={tab === 'catalog'} disabled={pending} onClick={() => setTab('catalog')}>{character ? '종족 도감' : '공용 도감'}</button>
        <button className="database-button" aria-pressed={tab === 'private'} disabled={pending} onClick={() => setTab('private')}>내 이미지</button>
      </div>
      {tab === 'private' ? <PrivateImageVaultGate onBusy={setPrivateBusy} pending={pending}>
        {(vaultId, key) => <PrivateWorldImagePicker workId={workId} vaultId={vaultId} vaultKey={key} selectedId={privateId}
          pending={pending} onBusy={setPrivateBusy} onSelect={image => { setPrivateId(image?.id); setSelection(null); setUseDefault(false); }} />}
      </PrivateImageVaultGate> : <>
      {!character && <div className="private-image-tabs" role="group" aria-label="도감 범위">
        <button type="button" className="database-button" aria-pressed={recommended} disabled={pending}
          onClick={() => { setRecommended(true); setPage(0); }}>장르 추천</button>
        <button type="button" className="database-button" aria-pressed={!recommended} disabled={pending}
          onClick={() => { setRecommended(false); setPage(0); }}>전체 도감</button>
      </div>}
      <form className="world-image-picker__search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}>
        <Search size={17} aria-hidden="true" />
        <input aria-label="대표 이미지 이름·별칭 검색" value={search} maxLength={100} placeholder="이름·별칭으로 찾기"
          onChange={event => setSearch(event.target.value)} />
        <button className="database-button" type="submit">검색</button>
      </form>
      <button type="button" className="world-image-picker__default" aria-pressed={!selection && !privateId && useDefault} onClick={() => { setSelection(null); setPrivateId(undefined); setUseDefault(true); }} disabled={pending}>
        <WorldSubjectImage category={category} fallbackSrc={character ? CHARACTER_DEFAULT_IMAGE : undefined} />
        <span><strong>{character ? '공통 기본 이미지' : '분류 기본 이미지'}</strong><small>아직 어울리는 이미지가 없다면</small></span>
        {!selection && !privateId && useDefault && <Check size={18} aria-hidden="true" />}
      </button>
      <button type="button" className="world-image-picker__automatic database-button" aria-pressed={!selection && !privateId && !useDefault}
        disabled={pending} onClick={() => { setSelection(null); setPrivateId(undefined); setUseDefault(false); }}>
        {!selection && !privateId && !useDefault && <Check size={16} aria-hidden="true" />}{character ? '종족 정보에 따라 자동 선택' : '대상 이름에 따라 자동 선택'}
        <small>{character ? '명확한 종족 정보가 없으면 공통 기본 이미지를 사용해요.' : '이름과 분류에 맞는 이미지가 없으면 기본 이미지를 사용해요.'}</small>
      </button>
      {catalog.isPending ? <p role="status"><Loader2 size={16} className="spin" /> 이미지를 불러오고 있어요.</p>
        : catalog.isError ? <div role="alert" className="world-image-picker__error"><p>도감을 불러오지 못했어요.</p>
          <button className="database-button" onClick={() => void catalog.refetch()}>다시 시도</button></div>
          : <>
            <div className="world-image-picker__grid" aria-label="대표 이미지 도감">
              {entries?.content?.map(entry => <button key={entry.id} type="button" className="world-image-picker__option"
                aria-label={`${entry.name} 이미지 선택`} aria-pressed={selection?.id === entry.id} disabled={pending} onClick={() => { setSelection(entry); setPrivateId(undefined); setUseDefault(false); }}>
          <WorldSubjectImage category={category} path={entry.thumbnailUrl} fallbackSrc={character ? CHARACTER_DEFAULT_IMAGE : undefined} />
                <span>{entry.name}{selection?.id === entry.id && <Check size={15} aria-hidden="true" />}</span>
              </button>)}
            </div>
            {!entries?.content?.length && <p className="world-image-picker__empty">{recommended ? '이 장르의 추천 이미지가 없어요. 전체 도감에서 찾아보세요.' : '검색 결과가 없어요. 다른 별칭을 입력하거나 기본 이미지를 사용해 주세요.'}
              {recommended && <button type="button" className="database-button" onClick={() => { setRecommended(false); setPage(0); }}>전체 도감에서 찾기</button>}
            </p>}
            <PageNavigation page={page} totalPages={entries?.totalPages ?? 0} disabled={catalog.isFetching || pending}
              onPageChange={setPage} />
          </>}
      </>}
      <div className="world-image-picker__footer">
        <div className="world-image-picker__selection" aria-live="polite"><ImagePlus size={16} aria-hidden="true" />{privateId ? '내 이미지' : selection?.name ?? (useDefault ? character ? '공통 기본 이미지' : '분류 기본 이미지' : character ? '종족 정보에 따라 자동 선택' : '대상 이름에 따라 자동 선택')} 선택</div>
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
            catalogId: selection?.id ?? null, privateImageId: privateId ?? null, version: expectedVersion, useDefault,
          })}>{mutation.isPending ? '저장 중…' : '이미지 저장'}</button>
        </div>
      </div>
    </div>
  </WorldSettingDialog>;
}
