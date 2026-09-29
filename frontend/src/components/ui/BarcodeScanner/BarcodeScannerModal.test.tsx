import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarcodeInput, BarcodeScannerModal } from './BarcodeScannerModal';

const decodeFromConstraints = vi.fn();

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn(() => ({ decodeFromConstraints })),
}));

function withCamera(getUserMedia: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: getUserMedia ? { getUserMedia } : undefined });
}

describe('BarcodeScannerModal', () => {
  afterEach(() => {
    decodeFromConstraints.mockReset();
    withCamera(undefined);
  });

  it('explains when the browser has no camera API and still accepts a typed code', () => {
    withCamera(undefined);
    const onDetected = vi.fn();
    render(<BarcodeScannerModal open onClose={vi.fn()} onDetected={onDetected} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/nhập mã thủ công/);
    const confirm = screen.getByRole('button', { name: 'Xác nhận' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Hoặc nhập mã vạch'), { target: { value: ' 8931234567890 ' } });
    fireEvent.click(confirm);
    expect(onDetected).toHaveBeenCalledWith('8931234567890');
  });

  it('reports the first decoded barcode once and stops the camera', async () => {
    withCamera(vi.fn());
    const stop = vi.fn();
    decodeFromConstraints.mockImplementation(async (_constraints, _video, callback) => {
      callback({ getText: () => '4006381333931' }, undefined, { stop });
      callback({ getText: () => '4006381333931' }, undefined, { stop });
      return { stop };
    });
    const onDetected = vi.fn();
    render(<BarcodeScannerModal open onClose={vi.fn()} onDetected={onDetected} />);

    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));
    expect(onDetected).toHaveBeenCalledWith('4006381333931');
    expect(stop).toHaveBeenCalled();
  });

  it('shows a permission message when camera access is denied', async () => {
    withCamera(vi.fn());
    decodeFromConstraints.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<BarcodeScannerModal open onClose={vi.fn()} onDetected={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Quyền camera đã bị từ chối');
  });
});

describe('BarcodeInput', () => {
  it('fills the field from the scanner without submitting the surrounding form', () => {
    withCamera(undefined);
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={onSubmit}><BarcodeInput id="barcode" value="" onChange={onChange} /></form>);

    fireEvent.click(screen.getByRole('button', { name: 'Quét mã vạch bằng camera' }));
    fireEvent.change(screen.getByLabelText('Hoặc nhập mã vạch'), { target: { value: '8930000000011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(onChange).toHaveBeenCalledWith('8930000000011');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
