import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SearchToolbar } from './SearchToolbar';

function Harness({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <SearchToolbar value={value} placeholder="Tìm mã đơn" onChange={setValue} onSearch={() => onSearch(value)} onRefresh={() => {}} />;
}

describe('SearchToolbar', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('searches as the user types, once they pause', () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    const input = screen.getByRole('searchbox', { name: 'Tìm kiếm' });
    fireEvent.change(input, { target: { value: 'HD29' } });
    fireEvent.change(input, { target: { value: 'HD2909' } });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith('HD2909');
  });

  it('does not search on first render', () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('still searches immediately on Enter', () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    const input = screen.getByRole('searchbox', { name: 'Tìm kiếm' });
    fireEvent.change(input, { target: { value: 'Linh' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('Linh');
    act(() => { vi.advanceTimersByTime(400); });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
