import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { WorkCoverImage } from './WorkCoverImage';

type Props = {
  workId: string; imageId?: string | null; draft: File | null | undefined;
  disabled: boolean; onChange: (file: File | null | undefined) => void;
  onValidating: (validating: boolean) => void;
};

export function WorkCoverEditor({ workId, imageId, draft, disabled, onChange, onValidating }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    if (!draft) return;
    const url = URL.createObjectURL(draft);
    setPreview({ file: draft, url });
    return () => URL.revokeObjectURL(url);
  }, [draft]);

  async function choose(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    setError(undefined);
    onValidating(true);
    const url = URL.createObjectURL(file);
    try {
      if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 이미지를 선택해 주세요.');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const text = new TextDecoder().decode(bytes);
      if (!png && !jpeg && !(text.startsWith('RIFF') && text.slice(8) === 'WEBP')) throw new Error('JPG·PNG·WebP 이미지를 선택해 주세요.');
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth > 4096 || image.naturalHeight > 4096) throw new Error('가로·세로 각각 4,096px 이하의 이미지를 선택해 주세요.');
      if (current === generation.current) onChange(file);
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error && failure.name !== 'EncodingError'
        ? failure.message : '이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');
    } finally {
      URL.revokeObjectURL(url);
      if (current === generation.current) onValidating(false);
    }
  }

  return <section className="work-cover-editor" aria-labelledby="work-cover-label">
    <div id="work-cover-label" className="work-cover-editor__label">표지 이미지 <span>(선택)</span></div>
    <div className="work-cover-editor__content">
      <WorkCoverImage workId={workId} imageId={draft === undefined ? imageId : null}
        previewUrl={draft && preview?.file === draft ? preview.url : undefined} alt="작품 표지 미리보기" className="work-cover-editor__preview" />
      <div className="work-cover-editor__controls">
        <p id="work-cover-help">JPG·PNG·WebP · 최대 5MB<br />가로·세로 각각 4,096px 이하</p>
        <div className="work-cover-editor__actions">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-label="표지 이미지 선택" aria-describedby="work-cover-help" disabled={disabled} hidden
            onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
          <button type="button" disabled={disabled} onClick={() => input.current?.click()}>
            <ImagePlus size={16} />{draft || (draft === undefined && imageId) ? '이미지 교체' : '이미지 선택'}
          </button>
          {(draft || (draft === undefined && imageId)) && <button type="button" disabled={disabled}
            onClick={() => { onChange(null); setError(undefined); }}><Trash2 size={16} />표지 삭제</button>}
          {draft !== undefined && <button type="button" disabled={disabled}
            onClick={() => { onChange(undefined); setError(undefined); }}>변경 취소</button>}
        </div>
        <p className="work-cover-editor__status" role="status">{draft === null ? '저장하면 기본 표지로 변경됩니다.' : '표지 변경은 저장을 누르면 반영됩니다.'}</p>
        {error && <p className="work-cover-editor__error" role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
