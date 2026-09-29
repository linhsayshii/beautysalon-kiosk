import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage, fitWithin } from './image-compress';

describe('fitWithin', () => {
  it('scales the longest edge down to the limit and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 });
  });

  it('never enlarges small photos', () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
  });
});

describe('compressImage', () => {
  const drawImage = vi.fn();
  const close = vi.fn();

  function mockCanvas(encodedTypes: Record<string, string>) {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback, type: string) => callback(new Blob(['x'], { type: encodedTypes[type] ?? 'image/png' })),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : null)) as never);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close })));
    return canvas;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    drawImage.mockReset();
    close.mockReset();
  });

  it('resizes to 1200px and encodes WebP, following EXIF orientation', async () => {
    const canvas = mockCanvas({ 'image/webp': 'image/webp' });
    const blob = await compressImage(new File(['raw'], 'photo.jpg', { type: 'image/jpeg' }));

    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
    expect([canvas.width, canvas.height]).toEqual([1200, 900]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 900);
    expect(blob.type).toBe('image/webp');
    expect(close).toHaveBeenCalled();
  });

  it('falls back to JPEG when the browser cannot encode WebP', async () => {
    mockCanvas({ 'image/jpeg': 'image/jpeg' });
    const blob = await compressImage(new File(['raw'], 'photo.heic', { type: 'image/heic' }));
    expect(blob.type).toBe('image/jpeg');
  });

  it('rejects files that are not images', async () => {
    await expect(compressImage(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow('Vui lòng chọn tệp hình ảnh');
  });
});
