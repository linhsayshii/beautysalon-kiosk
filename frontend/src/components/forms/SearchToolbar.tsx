import type { ReactNode } from 'react';

interface SearchToolbarProps { value: string; placeholder: string; onChange: (value: string) => void; onSearch: () => void; onRefresh: () => void; actions?: ReactNode }

export function SearchToolbar({ value, placeholder, onChange, onSearch, onRefresh, actions }: SearchToolbarProps) {
  return <div className="data-toolbar"><label className="search-control"><i className="ph ph-magnifying-glass" /><input type="search" value={value} placeholder={placeholder} aria-label="Tìm kiếm" onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSearch(); } }} /></label><div className="table-actions">{actions}<button className="toolbar-icon-button" type="button" onClick={onSearch} aria-label="Áp dụng bộ lọc"><i className="ph ph-funnel" /></button><button className="toolbar-icon-button" type="button" onClick={onRefresh} aria-label="Tải lại"><i className="ph ph-arrow-clockwise" /></button></div></div>;
}
