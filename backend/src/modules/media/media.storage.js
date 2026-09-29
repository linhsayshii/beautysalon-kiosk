import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../../config.js';
import { HttpError, parseOptionalHttpUrl } from '../../lib/http.js';

export const productImageUrlPrefix = '/api/v1/media/products/';
const productImageFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/;
const contentTypes = { webp: 'image/webp', jpg: 'image/jpeg' };

// The browser already compressed the photo; the server only checks it really is one of the two formats it asked for.
function detectImageExtension(buffer) {
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return null;
}

const branchProductDir = (branchId) => join(config.uploads.dir, String(Number(branchId)), 'products');

export function productImageFile({ branchId, fileName }) {
  const match = productImageFilePattern.exec(fileName);
  if (!match) return null;
  return { path: join(branchProductDir(branchId), fileName), contentType: contentTypes[match[1]] };
}

export async function saveProductImage({ branchId, buffer }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'IMAGE_REQUIRED', 'Vui lòng chọn ảnh');
  const extension = detectImageExtension(buffer);
  if (!extension) throw new HttpError(400, 'INVALID_IMAGE', 'Ảnh phải ở định dạng WebP hoặc JPEG');
  const fileName = `${randomUUID()}.${extension}`;
  const directory = branchProductDir(branchId);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, fileName), buffer, { flag: 'wx' });
  return `${productImageUrlPrefix}${fileName}`;
}

const internalFileName = (url) => (typeof url === 'string' && url.startsWith(productImageUrlPrefix) ? url.slice(productImageUrlPrefix.length) : null);

export async function deleteProductImage({ branchId, url }) {
  const fileName = internalFileName(url);
  if (!fileName) return;
  const file = productImageFile({ branchId, fileName });
  if (file) await rm(file.path, { force: true });
}

export function parseProductImageUrl(value, fieldName = 'imageUrl') {
  const candidate = String(value ?? '').trim();
  const fileName = internalFileName(candidate);
  if (fileName === null) return parseOptionalHttpUrl(candidate, fieldName);
  if (!productImageFilePattern.test(fileName)) throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} không hợp lệ`);
  return candidate;
}
