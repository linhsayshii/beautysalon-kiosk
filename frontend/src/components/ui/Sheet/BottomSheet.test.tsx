import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing while closed', () => {
    render(<BottomSheet open={false} onClose={vi.fn()} title="Bộ lọc">Nội dung</BottomSheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, body and footer with the standard sheet classes', () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Bộ lọc" subtitle="3 điều kiện" footer={<button type="button">Áp dụng</button>}>
        Nội dung
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Bộ lọc' });
    expect(dialog).toHaveClass('sheet');
    expect(screen.getByText('3 điều kiện')).toHaveClass('sheet-subtitle');
    expect(screen.getByText('Nội dung')).toHaveClass('sheet-body');
    expect(screen.getByRole('button', { name: 'Áp dụng' }).parentElement).toHaveClass('sheet-footer');
  });

  it('supports full height and muted variants', () => {
    render(<BottomSheet open onClose={vi.fn()} title="Chi tiết" height="full" tone="muted">Nội dung</BottomSheet>);
    expect(screen.getByRole('dialog')).toHaveClass('sheet', 'sheet-full', 'sheet-muted');
  });

  it('closes from the close button, Escape and the backdrop only', () => {
    const onClose = vi.fn();
    render(<BottomSheet open onClose={onClose} title="Bộ lọc" testId="filter">Nội dung</BottomSheet>);
    fireEvent.click(screen.getByText('Nội dung'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('filter-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
