import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileFilterSheet } from './MobileFilterSheet';

describe('MobileFilterSheet', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <MobileFilterSheet
        isOpen={false}
        onClose={() => {}}
        onApply={() => {}}
      >
        <div>Filter content</div>
      </MobileFilterSheet>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders content, title, and buttons when isOpen is true', () => {
    const handleClose = vi.fn();
    const handleApply = vi.fn();
    const handleReset = vi.fn();

    render(
      <MobileFilterSheet
        isOpen={true}
        title="Bộ lọc nâng cao"
        onClose={handleClose}
        onApply={handleApply}
        onReset={handleReset}
      >
        <div>Nội dung tiêu chí lọc</div>
      </MobileFilterSheet>
    );

    expect(screen.getByText('Bộ lọc nâng cao')).toBeInTheDocument();
    expect(screen.getByText('Nội dung tiêu chí lọc')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /đặt lại/i });
    const applyBtn = screen.getByRole('button', { name: /áp dụng/i });
    const closeBtn = screen.getByRole('button', { name: /đóng/i });

    expect(resetBtn).toBeInTheDocument();
    expect(applyBtn).toBeInTheDocument();
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);

    fireEvent.click(applyBtn);
    expect(handleApply).toHaveBeenCalledTimes(1);

    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking backdrop', () => {
    const handleClose = vi.fn();
    render(
      <MobileFilterSheet
        isOpen={true}
        onClose={handleClose}
        onApply={() => {}}
      >
        <div>Filter content</div>
      </MobileFilterSheet>
    );

    const backdrop = screen.getByTestId('mobile-filter-sheet-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
