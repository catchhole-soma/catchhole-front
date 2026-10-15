import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CircleCheckBig, Upload } from 'lucide-react';
import { ALLOWED_EXTENSIONS, validateManuscriptFile, formatFileSize } from '../../lib/fileValidation';
import { C } from './constants';

export function FileDropArea({
  file,
  onFileChange,
  error,
  fileLabel,
  allowedExtensions = ALLOWED_EXTENSIONS,
  disabled = false,
  inputTestId,
  keyboardAccessible = false,
  preserveFileOnError = false,
}: {
  file: File | null;
  onFileChange: (file: File | null, error: string | null) => void;
  error?: string | null;
  fileLabel: string;
  allowedExtensions?: readonly string[];
  disabled?: boolean;
  inputTestId?: string;
  keyboardAccessible?: boolean;
  preserveFileOnError?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  useEffect(() => {
    if (disabled) setDragging(false);
  }, [disabled]);

  const handleFile = (f: File | null | undefined) => {
    if (disabled) return;
    if (!f) { onFileChange(null, null); return; }
    const validationError = validateManuscriptFile(f, allowedExtensions);
    if (validationError) { onFileChange(preserveFileOnError ? file : null, validationError); return; }
    onFileChange(f, null);
  };

  return (
    <div className={`file-drop-area${file ? ' has-file' : ''}${error ? ' has-error' : ''}`} style={{ marginBottom: error ? 4 : 12 }}>
      <div
        className="file-drop-area__target"
        aria-disabled={disabled}
        role={keyboardAccessible ? 'button' : undefined}
        aria-label={keyboardAccessible ? '파일을 드래그하거나 클릭하여 선택' : undefined}
        tabIndex={keyboardAccessible && !disabled ? 0 : undefined}
        onKeyDown={event => {
          if (keyboardAccessible && !disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        style={{
          border: `2px dashed ${error ? C.danger : dragging ? C.primary : file ? C.success : C.border}`,
          borderRadius: 8, padding: '24px', textAlign: 'center',
          background: error ? C.danger + '08' : dragging ? C.primary + '08' : file ? C.success + '08' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <input
          data-testid={inputTestId} ref={inputRef} type="file" accept={allowedExtensions.join(',')} disabled={disabled} style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <CircleCheckBig size={18} color={C.success} />
            <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>
              {file.name} · {formatFileSize(file.size)}
            </span>
          </div>
        ) : (
          <>
            <Upload size={24} color={C.t3} style={{ margin: '0 auto 10px' }} />
            <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
            <div style={{ color: C.t3, fontSize: 12 }}>{allowedExtensions.join(', ')} 지원 (최대 10MB) · {fileLabel}</div>
          </>
        )}
      </div>
      {error && (
        <div role="alert" style={{ color: C.danger, fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
