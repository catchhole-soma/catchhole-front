const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAGIC = encoder.encode('CHI1');
const CHECK = 'Catchhole private image vault v1';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function base64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}
function unbase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
function aad(vaultId: string, imageId: string, part: string) {
  return encoder.encode(JSON.stringify(['CHI1', vaultId, imageId, part]));
}
async function seal(key: CryptoKey, data: BufferSource, associatedData: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associatedData, tagLength: 128 }, key, data));
  const envelope = new Uint8Array(16 + ciphertext.length);
  envelope.set(MAGIC); envelope.set(iv, 4); envelope.set(ciphertext, 16);
  return envelope;
}
async function open(key: CryptoKey, data: Uint8Array<ArrayBuffer>, associatedData: Uint8Array<ArrayBuffer>) {
  if (data.length < 33 || !MAGIC.every((byte, i) => data[i] === byte)) throw new Error('이미지 형식을 확인할 수 없어요.');
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(4, 16), additionalData: associatedData, tagLength: 128 }, key, data.slice(16));
}
export async function createPrivateImageVault() {
  if (!globalThis.crypto?.subtle) throw new Error('암호화 업로드는 보안 연결(HTTPS)에서 사용할 수 있어요.');
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const recoveryKey = `CHI1-${base64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  raw.fill(0);
  const id = crypto.randomUUID();
  const keyCheck = base64(await seal(key, encoder.encode(CHECK), aad(id, '', 'check')));
  return { id, key, keyCheck, recoveryKey };
}
export async function openPrivateImageVault(id: string, keyCheck: string, recoveryKey: string) {
  const value = recoveryKey.trim();
  if (!/^CHI1-[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('보관용 코드가 빠짐없이 입력됐는지 확인해 주세요.');
  const raw = unbase64(value.slice(5).replace(/-/g, '+').replace(/_/g, '/') + '=');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  raw.fill(0);
  try {
    if (decoder.decode(await open(key, unbase64(keyCheck), aad(id, '', 'check'))) !== CHECK) throw new Error();
  } catch { throw new Error('이 보관함의 코드가 아니에요. 처음 저장한 코드를 확인해 주세요.'); }
  return key;
}
function imageMime(bytes: Uint8Array): string {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  throw new Error('PNG, JPG, WebP 이미지만 올릴 수 있어요.');
}
export interface PrivateImageMetadata { name: string; mime: string; width: number; height: number }
export async function encryptPrivateImage(file: File, vaultId: string, key: CryptoKey) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('이미지는 8MB 이하로 선택해 주세요.');
  const original = await file.arrayBuffer();
  const mime = imageMime(new Uint8Array(original));
  const bitmap = await createImageBitmap(new Blob([original], { type: mime })).catch(() => {
    throw new Error('이미지를 읽을 수 없어요. 정상적인 PNG, JPG, WebP 파일을 선택해 주세요.');
  });
  try {
    if (bitmap.width * bitmap.height > 32_000_000 || bitmap.width > 16384 || bitmap.height > 16384) throw new Error('이미지 해상도를 줄여 주세요. 최대 3,200만 화소까지 지원해요.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 이미지를 준비할 수 없어요.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('썸네일을 만들지 못했어요.')), 'image/webp', 0.85));
    const id = crypto.randomUUID();
    const metadata: PrivateImageMetadata = { name: file.name.slice(0, 180), mime, width: bitmap.width, height: bitmap.height };
    const [image, thumb, encryptedMetadata] = await Promise.all([
      seal(key, original, aad(vaultId, id, 'image')),
      seal(key, await thumbnail.arrayBuffer(), aad(vaultId, id, 'thumbnail')),
      seal(key, encoder.encode(JSON.stringify(metadata)), aad(vaultId, id, 'metadata')),
    ]);
    return { id, vaultId, encryptedMetadata: base64(encryptedMetadata),
      image: new File([image], 'image.enc', { type: 'application/octet-stream' }),
      thumbnail: new File([thumb], 'thumbnail.enc', { type: 'application/octet-stream' }) };
  } finally { bitmap.close(); }
}
export async function decryptPrivateImage(key: CryptoKey, vaultId: string, id: string, part: 'image' | 'thumbnail', bytes: ArrayBuffer) {
  const plaintext = await open(key, new Uint8Array(bytes), aad(vaultId, id, part));
  return new Blob([plaintext], { type: imageMime(new Uint8Array(plaintext)) });
}
export async function decryptPrivateImageMetadata(key: CryptoKey, vaultId: string, id: string, value: string): Promise<PrivateImageMetadata> {
  const metadata = JSON.parse(decoder.decode(await open(key, unbase64(value), aad(vaultId, id, 'metadata')))) as PrivateImageMetadata;
  if (typeof metadata.name !== 'string' || !['image/png', 'image/jpeg', 'image/webp'].includes(metadata.mime)) throw new Error('이미지 정보를 열 수 없어요.');
  return metadata;
}
