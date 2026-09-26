import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MobileHeaderAction, MobilePageHeader } from './MobilePageHeader';

function renderAt(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/m/products']}>
      <Routes>
        <Route path="/m/products" element={ui} />
        <Route path="/m/more" element={<p>Trang Nhiều hơn</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MobilePageHeader', () => {
  it('renders the page title as the level-one heading', () => {
    renderAt(<MobilePageHeader title="Hàng hóa" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hàng hóa' })).toHaveClass('m-header-title');
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull();
  });

  it('navigates to backTo from the back button', () => {
    renderAt(<MobilePageHeader title="Hàng hóa" backTo="/m/more" />);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByText('Trang Nhiều hơn')).toBeInTheDocument();
  });

  it('prefers onBack over backTo', () => {
    const onBack = vi.fn();
    renderAt(<MobilePageHeader title="Hàng hóa" backTo="/m/more" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Trang Nhiều hơn')).toBeNull();
  });

  it('renders actions and extra rows', () => {
    const onSearch = vi.fn();
    renderAt(
      <MobilePageHeader
        title="Hàng hóa"
        actions={<MobileHeaderAction icon="ph ph-magnifying-glass" label="Tìm kiếm" active onClick={onSearch} />}
      >
        <input aria-label="Ô tìm kiếm" />
      </MobilePageHeader>,
    );
    const search = screen.getByRole('button', { name: 'Tìm kiếm' });
    expect(search).toHaveClass('btn', 'btn-ghost', 'btn-icon', 'is-active');
    expect(search).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(search);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Ô tìm kiếm').parentElement).toHaveClass('m-header-extra');
  });
});
