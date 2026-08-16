import type { Pagination as PaginationType } from '@/types/api';
import { formatNumber } from '@/lib/format';

export function Pagination({ pagination, onChange }: { pagination?: PaginationType; onChange: (page: number) => void }) {
  const page = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const pageSize = pagination?.pageSize ?? 10;
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <div className="table-footer"><span>Hiển thị {start}-{end} trên tổng số {formatNumber(total)} bản ghi</span><div className="pagination"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước"><i className="ph ph-caret-left" /></button><strong>{page}</strong><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Trang sau"><i className="ph ph-caret-right" /></button></div></div>;
}
