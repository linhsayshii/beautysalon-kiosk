import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileSegmentedControl } from './MobileSegmentedControl';

describe('MobileSegmentedControl', () => {
  it('renders options with labels, icons, badges and handles value change', () => {
    const handleChange = vi.fn();
    const options = [
      { value: 'all', label: 'Tất cả', badge: 12 },
      { value: 'active', label: 'Đang dùng', icon: 'ph ph-check' },
      { value: 'expired', label: 'Hết hạn' },
    ];

    render(
      <MobileSegmentedControl
        options={options}
        value="all"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Đang dùng')).toBeInTheDocument();
    expect(screen.getByText('Hết hạn')).toBeInTheDocument();

    const activeBtn = screen.getByRole('tab', { name: /tất cả/i });
    expect(activeBtn).toHaveClass('is-active');

    const expiredBtn = screen.getByRole('tab', { name: /hết hạn/i });
    fireEvent.click(expiredBtn);
    expect(handleChange).toHaveBeenCalledWith('expired');
  });
});
