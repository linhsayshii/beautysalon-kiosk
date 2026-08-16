interface ErrorStateProps { error: Error; onRetry: () => void }

export function LoadingState() {
  return <div className="table-loading"><div className="state-box"><i className="ph ph-database" /><strong>Đang tải dữ liệu</strong><div className="skeleton-lines"><span /><span /><span /></div></div></div>;
}

export function EmptyState({ message = 'Không tìm thấy dữ liệu phù hợp với bộ lọc.' }: { message?: string }) {
  return <div className="table-empty"><div className="state-box"><i className="ph ph-magnifying-glass" /><strong>Chưa có dữ liệu</strong><p>{message}</p></div></div>;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return <div className="table-error"><div className="state-box"><i className="ph ph-warning-circle" /><strong>Không thể tải dữ liệu</strong><p>{error.message}</p><button className="secondary-button" type="button" onClick={onRetry}>Thử lại</button></div></div>;
}
