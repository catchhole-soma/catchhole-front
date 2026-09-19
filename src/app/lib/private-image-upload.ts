function imageMime(bytes: Uint8Array): string {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  throw new Error('PNG, JPG, WebP 이미지만 올릴 수 있어요.');
}

/** 파일 입력 형식은 유지하되 개인 이미지 API에는 실행 가능한 메타데이터 없는 PNG를 보낸다. */
export async function preparePrivateImage(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하로 선택해 주세요.');
  const bytes = await file.arrayBuffer();
  const mime = imageMime(new Uint8Array(bytes));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime })).catch(() => {
    throw new Error('이미지를 읽을 수 없어요. 정상적인 PNG, JPG, WebP 파일을 선택해 주세요.');
  });
  try {
    if (bitmap.width * bitmap.height > 32_000_000 || Math.max(bitmap.width, bitmap.height) > 16384) {
      throw new Error('이미지 해상도를 줄여 주세요. 최대 3,200만 화소까지 지원해요.');
    }
    async function png(max: number, limit: number) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이 브라우저에서 이미지를 준비할 수 없어요.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value)
        : reject(new Error('이미지를 준비하지 못했어요.')), 'image/png'));
      if (blob.size > limit) throw new Error('변환한 이미지가 커요. 해상도를 줄인 뒤 다시 올려 주세요.');
      return blob;
    }
    const image = await png(16384, 5 * 1024 * 1024);
    const thumbnail = await png(480, 512 * 1024);
    return { id: crypto.randomUUID(), name: file.name.slice(0, 180), image, thumbnail };
  } finally { bitmap.close(); }
}
