export const ALLOWED_EXTENSIONS = ['.txt', '.docx'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateManuscriptFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));

  if (!hasAllowedExtension) {
    return `${ALLOWED_EXTENSIONS.join(', ')} 형식의 파일만 업로드할 수 있습니다.`;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `파일 용량은 ${formatFileSize(MAX_FILE_SIZE_BYTES)} 이하여야 합니다.`;
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
