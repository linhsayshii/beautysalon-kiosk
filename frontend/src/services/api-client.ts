export interface ApiEnvelope<T, M = Record<string, unknown>> {
  data: T;
  meta: M;
}

interface ApiErrorPayload {
  error?: {
    status?: number;
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

interface ApiErrorOptions {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

const REQUEST_TIMEOUT_MS = 20_000;

const statusMessages: Record<number, string> = {
  400: 'Yêu cầu không hợp lệ',
  401: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  403: 'Tài khoản không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu được yêu cầu',
  405: 'Phương thức gửi yêu cầu không được hỗ trợ',
  408: 'Yêu cầu mất quá nhiều thời gian để xử lý',
  409: 'Dữ liệu bị xung đột với trạng thái hiện tại',
  410: 'Dữ liệu hoặc mã xác thực đã hết hiệu lực',
  413: 'Dữ liệu gửi lên vượt quá giới hạn cho phép',
  415: 'Định dạng dữ liệu gửi lên không được hỗ trợ',
  422: 'Dữ liệu không thể được xử lý',
  429: 'Có quá nhiều yêu cầu, vui lòng thử lại sau',
  500: 'Lỗi máy chủ nội bộ, vui lòng thử lại sau',
  502: 'Máy chủ trả về phản hồi không hợp lệ',
  503: 'Không thể kết nối đến máy chủ',
  504: 'Máy chủ phản hồi quá thời gian cho phép',
};

const statusCodes: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_CONTENT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

function errorLabel(message: string, status: number, code: string, requestId?: string) {
  const reference = requestId ? ` · Mã tra cứu: ${requestId}` : '';
  return `${message} (${status} · ${code})${reference}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, options: ApiErrorOptions) {
    super(errorLabel(message, options.status, options.code, options.requestId), { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export const API_UNAUTHORIZED_EVENT = 'annachill:unauthorized';

type QueryValue = string | number | boolean | null | undefined;

export function toQueryString(values: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  });
  return params.toString();
}

export function clientErrorMessage(message: string, code: string) {
  return `${message} (${code})`;
}

export function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) return cause.message;
  return clientErrorMessage(fallback, 'CLIENT_ERROR');
}

function responseError(response: Response, payload: ApiErrorPayload) {
  const status = response.status;
  const receivedCode = payload.error?.code?.trim();
  const receivedMessage = payload.error?.message?.trim();
  const receivedRequestId = payload.error?.requestId?.trim() || response.headers.get('X-Request-Id')?.trim();
  const code = receivedCode && /^[A-Z][A-Z0-9_]{1,63}$/.test(receivedCode) ? receivedCode : statusCodes[status] ?? 'REQUEST_FAILED';
  const message = receivedMessage ? receivedMessage.slice(0, 500) : statusMessages[status] || `Máy chủ trả về HTTP ${status}`;
  const requestId = receivedRequestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(receivedRequestId) ? receivedRequestId : undefined;
  return new ApiError(message, {
    status,
    code,
    details: payload.error?.details,
    requestId,
  });
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    const body = await response.text();
    let payload: ApiErrorPayload = {};
    if (body) {
      try {
        payload = JSON.parse(body) as ApiErrorPayload;
      } catch (cause) {
        if (response.ok) {
          throw new ApiError('Máy chủ trả về dữ liệu không đúng định dạng JSON', {
            status: 502,
            code: 'INVALID_RESPONSE',
            requestId: response.headers.get('X-Request-Id') || undefined,
            cause,
          });
        }
      }
    }

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
      throw responseError(response, payload);
    }

    return (body ? payload : undefined) as T;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (timedOut) {
      throw new ApiError('Máy chủ phản hồi quá thời gian cho phép', {
        status: 504,
        code: 'REQUEST_TIMEOUT',
        cause,
      });
    }
    if (options.signal?.aborted) {
      throw new ApiError('Yêu cầu đã bị hủy', { status: 499, code: 'REQUEST_CANCELLED', cause });
    }
    throw new ApiError('Không thể kết nối đến máy chủ. Hãy kiểm tra mạng và thử lại', {
      status: 503,
      code: 'NETWORK_ERROR',
      cause,
    });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
