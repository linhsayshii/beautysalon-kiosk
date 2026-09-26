import { useCallback } from 'react';
import { useToast } from './ToastProvider';

/** Controls whose feature is not built yet show this message instead of doing nothing. */
export function useComingSoon() {
  const { notify } = useToast();
  return useCallback(() => notify('Tính năng đang triển khai', 'Chức năng này chưa sẵn sàng, vui lòng quay lại sau.'), [notify]);
}
