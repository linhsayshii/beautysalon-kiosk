/** Longest edge of a stored product photo; enough for a full-screen preview on a phone. */
export const MAX_IMAGE_EDGE = 1200;
/** The API rejects anything larger. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Shrinks a camera photo before upload: honours EXIF rotation, caps the longest edge and re-encodes as WebP
 * (JPEG where the browser cannot encode WebP, e.g. Safari). Redrawing also drops EXIF metadata such as GPS.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn tệp hình ảnh');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Không đọc được ảnh này. Hãy thử ảnh JPEG hoặc PNG khác');
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    const webp = await encode(canvas, 'image/webp', 0.8);
    // Browsers without a WebP encoder silently return PNG instead.
    const blob = webp?.type === 'image/webp' ? webp : await encode(canvas, 'image/jpeg', 0.82);
    if (!blob || (blob.type !== 'image/webp' && blob.type !== 'image/jpeg')) throw new Error('Trình duyệt không nén được ảnh');
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('Ảnh sau khi nén vẫn lớn hơn 1 MB');
    return blob;
  } finally {
    bitmap.close();
  }
}
