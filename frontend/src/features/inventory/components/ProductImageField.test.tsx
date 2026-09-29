import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductImageField } from './ProductImageField';
import { ProductImageViewButton } from './ProductImageViewButton';
import { uploadProductImage } from '../inventory.api';
import { compressImage } from '@/lib/image-compress';

vi.mock('@/lib/image-compress', () => ({ compressImage: vi.fn() }));
vi.mock('../inventory.api', () => ({ uploadProductImage: vi.fn() }));

const uploadedUrl = '/api/v1/media/products/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

function Harness({ initial = '', onUploadingChange = () => {} }: { initial?: string; onUploadingChange?: (value: boolean) => void }) {
  const [value, setValue] = useState(initial);
  return <QueryClientProvider client={new QueryClient()}>
    <ProductImageField value={value} onChange={setValue} onUploadingChange={onUploadingChange} />
    <output data-testid="value">{value}</output>
  </QueryClientProvider>;
}

const photo = () => new File(['raw'], 'photo.jpg', { type: 'image/jpeg' });

describe('ProductImageField', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers the camera and the file picker, with the camera input using the rear camera', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Chụp ảnh' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chọn ảnh' })).toBeEnabled();
    expect(screen.getByTestId('goods-image-camera')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('goods-image-file')).not.toHaveAttribute('capture');
    expect(screen.getByText('Chưa có ảnh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa ảnh' })).not.toBeInTheDocument();
  });

  it('compresses, uploads and stores the returned URL while reporting the upload state', async () => {
    const compressed = new Blob(['small'], { type: 'image/webp' });
    vi.mocked(compressImage).mockResolvedValue(compressed);
    vi.mocked(uploadProductImage).mockResolvedValue({ data: { url: uploadedUrl } });
    const onUploadingChange = vi.fn();
    render(<Harness onUploadingChange={onUploadingChange} />);

    fireEvent.change(screen.getByTestId('goods-image-camera'), { target: { files: [photo()] } });

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent(uploadedUrl));
    expect(uploadProductImage).toHaveBeenCalledWith(compressed);
    expect(screen.getByRole('img', { name: 'Ảnh hàng hóa' })).toHaveAttribute('src', uploadedUrl);
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('shows the error and keeps the previous photo when the upload fails', async () => {
    vi.mocked(compressImage).mockRejectedValue(new Error('Vui lòng chọn tệp hình ảnh'));
    render(<Harness initial="https://images.example.com/old.png" />);

    fireEvent.change(screen.getByTestId('goods-image-file'), { target: { files: [photo()] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng chọn tệp hình ảnh');
    expect(screen.getByTestId('value')).toHaveTextContent('https://images.example.com/old.png');
  });

  it('removes the photo', () => {
    render(<Harness initial={uploadedUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });
});

describe('ProductImageViewButton', () => {
  it('renders nothing when the item has no photo', () => {
    const { container } = render(<ProductImageViewButton imageUrl="" name="Serum" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the photo in a dialog', () => {
    render(<ProductImageViewButton imageUrl={uploadedUrl} name="Serum" />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh Serum' }));
    expect(screen.getByRole('dialog', { name: 'Serum' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ảnh Serum' })).toHaveAttribute('src', uploadedUrl);
  });
});
