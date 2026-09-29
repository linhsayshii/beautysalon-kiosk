import { useState } from 'react';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { errorMessage } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';
import { findPosItemsByBarcode } from './pos.api';

interface BarcodeLookupHandlers {
  /** Exactly one item has this barcode or code. */
  onFound: (item: ApiRecord) => void;
  /** Several items share the code; the view should list them so the cashier picks one. */
  onAmbiguous: (code: string) => void;
}

/**
 * Resolves a scanned barcode (or exact item code) to a catalog item at the
 * customer's price. Request failures are reported as toasts, and so are
 * unknown codes unless `reportMissing` is false (e.g. Enter in a search box,
 * where the text may be a name). Resolves to whether an item was added.
 */
export function usePosBarcodeLookup(customerId: number | null | undefined, { onFound, onAmbiguous }: BarcodeLookupHandlers) {
  const { notify } = useToast();
  const [isLooking, setIsLooking] = useState(false);

  const lookup = async (code: string, { reportMissing = true } = {}) => {
    setIsLooking(true);
    try {
      const items = await findPosItemsByBarcode(code, customerId);
      if (items.length === 1) {
        onFound(items[0]);
        return true;
      }
      if (items.length > 1) {
        onAmbiguous(code.trim());
        notify('Nhiều hàng hóa cùng mã', `Có ${items.length} hàng hóa dùng mã "${code.trim()}". Hãy chọn đúng hàng trong danh sách.`);
      } else if (reportMissing) {
        notify('Không tìm thấy hàng hóa', `Không có hàng hóa nào có mã vạch hoặc mã hàng "${code.trim()}".`);
      }
      return false;
    } catch (cause) {
      notify('Không tra được mã vạch', errorMessage(cause, 'Vui lòng thử lại.'));
      return false;
    } finally {
      setIsLooking(false);
    }
  };

  return { lookup, isLooking };
}
