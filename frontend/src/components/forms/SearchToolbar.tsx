import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface SearchToolbarProps { value: string; placeholder: string; onChange: (value: string) => void; onSearch: () => void; onRefresh: () => void; actions?: ReactNode }

/** Pause after typing before the list searches, so each keystroke does not hit the API. */
const SEARCH_DELAY_MS = 400;

export function SearchToolbar({ value, placeholder, onChange, onSearch, onRefresh, actions }: SearchToolbarProps) {
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  // The value last searched, so Enter does not trigger a second search.
  const searchedValue = useRef(value);

  const search = () => {
    searchedValue.current = value;
    onSearch();
  };

  useEffect(() => {
    if (value === searchedValue.current) return undefined;
    const timer = window.setTimeout(() => {
      if (value === searchedValue.current) return;
      searchedValue.current = value;
      onSearchRef.current();
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  return <div className="data-toolbar"><label className="search-control"><i className="ph ph-magnifying-glass" /><input type="search" value={value} placeholder={placeholder} aria-label="Tìm kiếm" onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} /></label><div className="table-actions">{actions}<button className="btn btn-secondary btn-icon" type="button" onClick={onRefresh} aria-label="Tải lại"><i className="ph ph-arrow-clockwise" /></button></div></div>;
}
