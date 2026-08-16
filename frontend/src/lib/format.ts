const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

export const formatNumber = (value: unknown) => numberFormatter.format(Number(value ?? 0));
export const formatMoney = (value: unknown) => `${formatNumber(value)}đ`;
export const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.max(0, value);
  const cleaned = String(value ?? '').replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};
export const formatPercent = (value: unknown) => `${Math.round(Number(value ?? 0) * 100)}%`;
export const formatDate = (value: unknown) => value ? dateFormatter.format(new Date(String(value))) : 'Không giới hạn';
export const formatDateTime = (value: unknown) => value ? dateTimeFormatter.format(new Date(String(value))) : '-';
export const formatTime = (value: unknown) => value ? new Date(String(value)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-';

export function initials(name: unknown) {
  return String(name ?? '').trim().split(/\s+/).slice(-2).map((part) => part[0] ?? '').join('').toUpperCase();
}

export function relativeTime(value: unknown) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(String(value)).getTime()) / 60_000));
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  return diffHours < 24 ? `${diffHours} giờ trước` : `${Math.round(diffHours / 24)} ngày trước`;
}
