import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileSearchBar } from './MobileSearchBar';

describe('MobileSearchBar', () => {
  it('renders search input with placeholder and value', () => {
    const handleChange = vi.fn();
    render(
      <MobileSearchBar
        value="test query"
        placeholder="Tìm kiếm..."
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText('Tìm kiếm...') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('test query');
  });

  it('calls onChange when input text changes', () => {
    const handleChange = vi.fn();
    render(
      <MobileSearchBar
        value=""
        placeholder="Tìm kiếm..."
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText('Tìm kiếm...');
    fireEvent.change(input, { target: { value: 'Khách hàng A' } });
    expect(handleChange).toHaveBeenCalledWith('Khách hàng A');
  });

  it('shows clear button when value is not empty and clears input on click', () => {
    const handleChange = vi.fn();
    render(
      <MobileSearchBar
        value="Có nội dung"
        onChange={handleChange}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /xóa/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('renders filter button with badge when onFilterClick is provided', () => {
    const handleFilter = vi.fn();
    render(
      <MobileSearchBar
        value=""
        onFilterClick={handleFilter}
        activeFilterCount={3}
      />
    );

    const filterBtn = screen.getByRole('button', { name: /bộ lọc/i });
    expect(filterBtn).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    fireEvent.click(filterBtn);
    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('renders optional action node if provided', () => {
    render(
      <MobileSearchBar
        value=""
        onChange={() => {}}
        action={<button>Thêm mới</button>}
      />
    );

    expect(screen.getByText('Thêm mới')).toBeInTheDocument();
  });
});
