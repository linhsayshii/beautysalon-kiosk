import express, { Router } from 'express';
import { asyncRoute, HttpError } from '../../lib/http.js';
import { permissions, requirePermissions } from '../auth/auth.permissions.js';
import { productImageFile, saveProductImage } from './media.storage.js';

const router = Router();
const maximumImageBytes = 1024 * 1024;

// Mounted in app.js ahead of requireJsonBody, which lets the resulting Buffer body through.
export const productImageBodyParser = [
  (request, response, next) => {
    if (request.method !== 'POST' || request.is(['image/webp', 'image/jpeg'])) return next();
    return next(new HttpError(415, 'IMAGE_TYPE_REQUIRED', 'Ảnh tải lên phải dùng image/webp hoặc image/jpeg'));
  },
  express.raw({ type: ['image/webp', 'image/jpeg'], limit: maximumImageBytes }),
];

router.post('/product-images', requirePermissions(permissions.manageInventory), asyncRoute(async (request, response) => {
  const url = await saveProductImage({ branchId: request.account.branchId, buffer: request.body });
  response.status(201).json({ data: { url } });
}));

router.get('/products/:fileName', (request, response, next) => {
  const file = productImageFile({ branchId: request.account.branchId, fileName: request.params.fileName });
  if (!file) return next(new HttpError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh'));
  // File names are random and never reused, so the browser may keep the image for good.
  response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  response.type(file.contentType);
  return response.sendFile(file.path, { dotfiles: 'deny', headers: { 'Content-Type': file.contentType } }, (error) => {
    if (!error) return;
    if (response.headersSent) return;
    response.setHeader('Cache-Control', 'no-store');
    next(error.code === 'ENOENT' || error.status === 404 ? new HttpError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh') : error);
  });
});

export default router;
