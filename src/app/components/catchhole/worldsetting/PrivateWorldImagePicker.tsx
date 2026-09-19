import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Upload } from 'lucide-react';
import { deletePrivateWorldImageMutation, getPrivateWorldImagesOptions, uploadPrivateWorldImageMutation } from '../../../api/generated/@tanstack/react-query.gen';
import type { PrivateWorldImageResponse, UploadPrivateWorldImageData } from '../../../api/generated/types.gen';
import { preparePrivateImage } from '../../../lib/private-image-upload';
import { privateImageSessionEpoch, usePrivateImageSession } from '../../../lib/private-image-session';
import { toApiError } from '../../../lib/api-errors';
import { PageNavigation } from '../PageNavigation';
import { PrivateSubjectImage } from './PrivateSubjectImage';

function PrivateImageOption({ image, workId, selected, pending, onSelect, onDelete }: {
  image: PrivateWorldImageResponse; workId: string;
  selected: boolean; pending: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const name = image.name ?? (image.vaultId ? '이전 방식으로 보관한 이미지' : '내 이미지');
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <div className="private-image-option">
    <button type="button" className="world-image-picker__option" aria-label={`${name} 이미지 선택`} aria-pressed={selected} disabled={pending} onClick={onSelect}>
      <PrivateSubjectImage workId={workId} imageId={image.id!} vaultId={image.vaultId} />
      <span><span className="private-image-name">{name}</span>{selected && <Check size={15} aria-hidden="true" />}</span>
    </button>
    {!confirmDelete ? <button className="private-image-delete" disabled={pending} onClick={() => setConfirmDelete(true)}>삭제</button>
      : <div className="private-image-delete-confirm"><span>이미지를 삭제할까요?</span><button disabled={pending} onClick={onDelete}>삭제하기</button><button disabled={pending} onClick={() => setConfirmDelete(false)}>취소</button></div>}
  </div>;
}

export function PrivateWorldImagePicker(props: Parameters<typeof AccountPrivateWorldImagePicker>[0]) {
  const session = usePrivateImageSession();
  return <AccountPrivateWorldImagePicker key={session} {...props} />;
}

function AccountPrivateWorldImagePicker({ workId, selectedId, pending, onSelect, onBusy }: {
  workId: string; selectedId?: string; pending: boolean;
  onSelect: (image: PrivateWorldImageResponse | null) => void; onBusy: (busy: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = getPrivateWorldImagesOptions({ path: { workId }, query: { page, size: 18 } });
  const list = useQuery({ ...options, queryKey: [{ ...options.queryKey[0], tags: [`session:${privateImageSessionEpoch()}`] }], gcTime: 0 });
  const upload = useMutation(uploadPrivateWorldImageMutation());
  const remove = useMutation(deletePrivateWorldImageMutation());
  const entries = list.data?.data;
  const disabled = busy || pending;
  function beginAction() {
    setBusy(true); onBusy(true); setError('');
    return privateImageSessionEpoch();
  }
  function endAction() { setBusy(false); onBusy(false); }
  async function reportError(cause: unknown) {
    setError(toApiError(cause)?.message ?? (cause instanceof Error ? cause.message : '이미지 작업을 마치지 못했어요. 목록을 확인한 뒤 다시 시도해 주세요.'));
    await list.refetch();
  }
  async function uploadFile(file: File) {
    const epoch = beginAction();
    try {
      const prepared = await preparePrivateImage(file);
      if (epoch !== privateImageSessionEpoch()) return;
      const result = await upload.mutateAsync({ path: { workId }, body: {
        metadata: { id: prepared.id, name: prepared.name }, image: prepared.image, thumbnail: prepared.thumbnail,
      }, bodySerializer: body => {
        const value = body as NonNullable<UploadPrivateWorldImageData['body']>;
        const data = new FormData();
        data.append('metadata', new Blob([JSON.stringify(value.metadata)], { type: 'application/json' }), 'metadata.json');
        data.append('image', value.image, 'image.png'); data.append('thumbnail', value.thumbnail, 'thumbnail.png');
        return data;
      } });
      if (epoch !== privateImageSessionEpoch()) return;
      if (result.data) onSelect(result.data);
      setPage(0); await list.refetch();
    } catch (cause) { if (epoch === privateImageSessionEpoch()) await reportError(cause); }
    finally { endAction(); }
  }
  async function deleteImage(image: PrivateWorldImageResponse) {
    const epoch = beginAction();
    try {
      await remove.mutateAsync({ path: { workId, imageId: image.id! } });
      if (epoch !== privateImageSessionEpoch()) return;
      if (selectedId === image.id) onSelect(null);
      if (entries?.content?.length === 1 && page > 0) setPage(page - 1);
      await list.refetch();
    } catch (cause) { if (epoch === privateImageSessionEpoch()) await reportError(cause); }
    finally { endAction(); }
  }
  return <>
    <p className="world-image-picker__description">이 작품에만 사용하는 이미지이며, 나만 볼 수 있어요.</p>
    <div className="private-image-upload">
      <label className={`database-button private-image-upload__button${disabled ? ' is-disabled' : ''}`}><Upload size={16} aria-hidden="true" />{busy ? '처리 중…' : '이미지 올리기'}
        <input type="file" aria-label="내 이미지 파일 선택" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          void uploadFile(file);
        }} />
      </label>
      <small>PNG · JPG · WebP, 최대 5MB · 작품당 50개</small>
    </div>
    {error && <p role="alert" className="world-image-picker__error">{error}</p>}
    {list.isPending ? <p role="status">내 이미지를 불러오고 있어요.</p>
      : list.isError ? <div role="alert"><p>목록을 불러오지 못했어요.</p><button className="database-button" onClick={() => void list.refetch()}>다시 시도</button></div>
        : <>
          <div className="world-image-picker__grid" aria-label="내 이미지 목록">
            {entries?.content?.map(image => <PrivateImageOption key={image.id} image={image} workId={workId}
              selected={selectedId === image.id} pending={disabled} onSelect={() => onSelect(image)} onDelete={() => void deleteImage(image)} />)}
          </div>
          {!entries?.content?.length && <p className="world-image-picker__empty">아직 올린 이미지가 없어요. 이 작품에 어울리는 이미지를 올려 보세요.</p>}
          <PageNavigation page={page} totalPages={entries?.totalPages ?? 0} disabled={disabled || list.isFetching} onPageChange={setPage} />
        </>}
  </>;
}
