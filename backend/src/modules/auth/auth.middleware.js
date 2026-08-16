import { HttpError } from '../../lib/http.js';
import { accountFromToken, readSessionCookie } from './auth.service.js';

export async function requireAuth(request, response, next) {
  try {
    const account = await accountFromToken(readSessionCookie(request));
    if (!account) throw new HttpError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục');
    request.account = account;
    next();
  } catch (error) {
    next(error);
  }
}
