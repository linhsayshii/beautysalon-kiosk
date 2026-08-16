export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function parsePositiveInteger(value, fieldName, fallback) {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (!/^\d+$/.test(String(value))) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải là số nguyên dương`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải là số nguyên dương`);
  }
  return parsed;
}

export function parseIsoDate(value, fieldName, fallback) {
  const candidate = value || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate ?? '')) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải có định dạng YYYY-MM-DD`);
  }
  const [year, month, day] = candidate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} không phải ngày hợp lệ`);
  }
  return candidate;
}

export function parsePagination(query) {
  const page = parsePositiveInteger(query.page, 'page', 1);
  const pageSize = parsePositiveInteger(query.pageSize, 'pageSize', 10);
  if (pageSize > 100) {
    throw new HttpError(400, 'INVALID_ARGUMENT', 'pageSize không được vượt quá 100');
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function parseEnum(value, fieldName, allowedValues, fallback = '') {
  if (value === undefined || value === '') return fallback;
  if (!allowedValues.includes(value)) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} có giá trị không được hỗ trợ`, {
      allowedValues,
    });
  }
  return value;
}

export function parseDateTime(value, fieldName) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải là ngày giờ hợp lệ`);
  }
  return parsed;
}

export function parseOptionalHttpUrl(value, fieldName, maximumLength = 1000) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';
  if (candidate.length > maximumLength) throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} quá dài`);
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('unsupported URL');
    return parsed.toString();
  } catch {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải là URL HTTP(S) hợp lệ`);
  }
}

export function parseTime(value, fieldName) {
  const candidate = String(value ?? '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(candidate);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${fieldName} phải có định dạng HH:MM`);
  }
  return candidate;
}
