import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, clientErrorMessage, errorMessage, toQueryString } from './api-client';

function mockResponse(status: number, body = '', requestId?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name.toLowerCase() === 'x-request-id' ? requestId ?? null : null },
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => vi.restoreAllMocks());

describe('toQueryString', () => {
  it('keeps meaningful values and removes empty filters', () => {
    const result = new URLSearchParams(toQueryString({ locationId: 7, search: '', page: 2, active: false, missing: undefined }));
    expect(Object.fromEntries(result)).toEqual({ locationId: '7', page: '2', active: 'false' });
  });
});

describe('apiRequest error details', () => {
  it('includes the HTTP status, application code and request reference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(400, JSON.stringify({
      error: { status: 400, code: 'INVALID_ARGUMENT', message: 'Ngày bắt đầu không hợp lệ', requestId: 'req-123' },
    }))));

    const error = await apiRequest('/orders').catch((cause) => cause) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'INVALID_ARGUMENT', requestId: 'req-123' });
    expect(error.message).toBe('Ngày bắt đầu không hợp lệ (400 · INVALID_ARGUMENT) · Mã tra cứu: req-123');
  });

  it('uses a complete Vietnamese fallback when the server omits its error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(500, '', 'req-500')));

    await expect(apiRequest('/dashboard')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Lỗi máy chủ nội bộ, vui lòng thử lại sau (500 · INTERNAL_SERVER_ERROR) · Mã tra cứu: req-500',
    });
  });

  it('turns a failed connection into a stable 503 network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(apiRequest('/dashboard')).rejects.toMatchObject({
      status: 503,
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ. Hãy kiểm tra mạng và thử lại (503 · NETWORK_ERROR)',
    });
  });

  it('reports malformed successful responses as a 502 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, '<html>not json</html>', 'req-json')));

    await expect(apiRequest('/dashboard')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
      requestId: 'req-json',
    });
  });

  it('accepts an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(204)));
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});

describe('client-side error messages', () => {
  it('adds stable codes without hiding API errors', () => {
    expect(clientErrorMessage('Không mở được camera', 'CAMERA_UNAVAILABLE')).toBe('Không mở được camera (CAMERA_UNAVAILABLE)');
    expect(errorMessage(new Error('unknown'), 'Không thể lưu')).toBe('Không thể lưu (CLIENT_ERROR)');
  });
});
