import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Thêm ca"><div className="modal-body">Nội dung</div></Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled dialog with the standard size class', () => {
    render(
      <Modal open onClose={vi.fn()} title="Thêm ca" subtitle="Tuần 39" size="lg">
        <div className="modal-body">Nội dung</div>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Thêm ca' });
    expect(dialog).toHaveClass('modal', 'modal-lg');
    expect(screen.getByText('Tuần 39')).toHaveClass('modal-subtitle');
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });

  it('closes from the close button and Escape', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Thêm ca"><div className="modal-body" /></Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on a backdrop click but not on a click inside the dialog', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Thêm ca" testId="shift-modal"><div className="modal-body">Nội dung</div></Modal>);
    fireEvent.click(screen.getByText('Nội dung'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('shift-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the backdrop inert when closeOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Thanh toán" closeOnBackdrop={false} testId="pay"><div className="modal-body" /></Modal>);
    fireEvent.click(screen.getByTestId('pay-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
