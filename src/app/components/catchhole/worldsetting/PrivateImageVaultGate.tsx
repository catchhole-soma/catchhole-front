import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { createPrivateImageVaultMutation, getPrivateImageVaultOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { createPrivateImageVault, openPrivateImageVault } from '../../../lib/private-image-crypto';
import { clearPrivateImageKeys, privateImageSessionEpoch, unlockPrivateImageKey } from '../../../lib/private-image-keys';
import { toApiError } from '../../../lib/api-errors';
import { usePrivateImageKey } from '../../../lib/use-private-image-key';

type NewVault = Awaited<ReturnType<typeof createPrivateImageVault>>;
export function PrivateImageVaultGate({ children, onBusy, pending }: {
  children: (vaultId: string, key: CryptoKey) => ReactNode;
  onBusy: (busy: boolean) => void;
  pending: boolean;
}) {
  const queryClient = useQueryClient();
  const vault = useQuery(getPrivateImageVaultOptions());
  const current = vault.data?.data;
  const key = usePrivateImageKey(current?.id);
  const mutation = useMutation(createPrivateImageVaultMutation());
  const [draft, setDraft] = useState<NewVault>();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function beginAction() {
    setBusy(true); onBusy(true); setError('');
    return privateImageSessionEpoch();
  }
  function endAction() { setBusy(false); onBusy(false); }
  function reportError(cause: unknown) {
    setError(toApiError(cause)?.message ?? (cause instanceof Error ? cause.message : '보관함을 열지 못했어요. 다시 시도해 주세요.'));
  }
  async function handleUnlock() {
    if (!current?.id || !current.keyCheck) return;
    const epoch = beginAction();
    try {
      const opened = await openPrivateImageVault(current.id, current.keyCheck, recoveryKey);
      unlockPrivateImageKey(current.id, opened, epoch); setRecoveryKey('');
    } catch (cause) { reportError(cause); }
    finally { endAction(); }
  }
  async function handlePrepare() {
    const epoch = beginAction();
    try {
      const created = await createPrivateImageVault();
      if (privateImageSessionEpoch() === epoch) setDraft(created);
    } catch (cause) { reportError(cause); }
    finally { endAction(); }
  }
  async function handleCreate() {
    if (!draft) return;
    const epoch = beginAction();
    try {
      await mutation.mutateAsync({ body: { id: draft.id, keyCheck: draft.keyCheck } });
      unlockPrivateImageKey(draft.id, draft.key, epoch);
      setDraft(undefined); setSaved(false);
      await queryClient.invalidateQueries({ queryKey: getPrivateImageVaultOptions().queryKey });
    } catch (cause) {
      if (toApiError(cause)?.code === 'PRIVATE_IMAGE_VAULT_CONFLICT') {
        setDraft(undefined); setSaved(false);
        await vault.refetch();
      }
      reportError(cause);
    }
    finally { endAction(); }
  }
  if (vault.isPending) return <p role="status">내 이미지 보관함을 확인하고 있어요.</p>;
  if (vault.isError) return <div role="alert"><p>보관함을 확인하지 못했어요.</p><button className="database-button" onClick={() => void vault.refetch()}>다시 시도</button></div>;
  if (current?.id && key) return <>
    <div className="private-image-notice"><span>이 작품에서만 사용하는 내 이미지예요.</span><button className="database-button" disabled={pending} onClick={clearPrivateImageKeys}>보관함 잠그기</button></div>
    {children(current.id, key)}
  </>;
  return <section className="private-image-vault" aria-label="내 이미지 잠금 설정">
    <LockKeyhole size={24} aria-hidden="true" />
    <h3>{current ? '내 이미지 잠금 풀기' : '나만 여는 이미지 보관함'}</h3>
    <p>이미지와 파일명을 이 브라우저에서 암호화해 저장해요. 복구키는 서버에 보내지 않아요.</p>
    {current?.id && current.keyCheck ? <form onSubmit={event => {
      event.preventDefault(); void handleUnlock();
    }}>
      <label htmlFor="private-image-recovery">복구키</label>
      <input id="private-image-recovery" type="password" autoComplete="off" spellCheck={false} value={recoveryKey}
        onChange={event => setRecoveryKey(event.target.value)} placeholder="CHI1-로 시작하는 복구키" disabled={busy} />
      <button type="submit" className="database-button is-primary" disabled={busy || !recoveryKey.trim()}>{busy ? '여는 중…' : '잠금 풀기'}</button>
    </form> : !draft ? <button className="database-button is-primary" disabled={busy} onClick={() => void handlePrepare()}>보관함 만들기</button> : <>
      <p><strong>복구키를 안전한 곳에 보관해 주세요.</strong> 키를 잃으면 저희도 이미지를 복원할 수 없어요. 로그인 비밀번호와는 달라요.</p>
      <label htmlFor="private-image-new-key">새 복구키</label>
      <input id="private-image-new-key" className="private-image-key" readOnly value={draft.recoveryKey} onFocus={event => event.target.select()} />
      <button className="database-button" onClick={() => {
        const url = URL.createObjectURL(new Blob([`Catchhole 이미지 복구키\n${draft.recoveryKey}\n\n타인과 공유하지 마세요.\n`], { type: 'text/plain' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'catchhole-image-recovery-key.txt'; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>복구키 파일 저장</button>
      <label className="private-image-confirm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />복구키를 안전한 곳에 저장했어요.</label>
      <button className="database-button is-primary" disabled={!saved || busy} onClick={() => void handleCreate()}>{busy ? '만드는 중…' : '보관함 사용하기'}</button>
    </>}
    <p className="private-image-vault__hint">새로고침하거나 다시 로그인하면 복구키를 다시 입력해 주세요.</p>
    {error && <p role="alert" className="world-image-picker__error">{error}</p>}
  </section>;
}
