import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileDetailSheet } from './MobileDetailSheet';

describe('MobileDetailSheet', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <MobileDetailSheet
        isOpen={false}
        title="Chi tiết khách hàng"
        onClose={() => {}}
      >
        <div>Nội dung chi tiết</div>
      </MobileDetailSheet>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders title, subtitle, children, footer actions and handles close', () => {
    const handleClose = vi.fn();
    render(
      <MobileDetailSheet
        isOpen={true}
        title="Nguyễn Thị Lan"
        subtitle="Mã: KH001"
        onClose={handleClose}
        footerActions={<button>Lưu thay đổi</button>}
      >
        <div>Thông tin chi tiết ở đây</div>
      </MobileDetailSheet>
    );

    expect(screen.getByText('Nguyễn Thị Lan')).toBeInTheDocument();
    expect(screen.getByText('Mã: KH001')).toBeInTheDocument();
    expect(screen.getByText('Thông tin chi tiết ở đây')).toBeInTheDocument();
    expect(screen.getByText('Lưu thay đổi')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /đóng/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const handleClose = vi.fn();
    render(
      <MobileDetailSheet
        isOpen={true}
        title="Chi tiết"
        onClose={handleClose}
      >
        <div>Body</div>
      </MobileDetailSheet>
    );

    const backdrop = screen.getByTestId('mobile-detail-sheet-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
