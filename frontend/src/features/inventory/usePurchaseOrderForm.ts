import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { createPurchaseOrder, getSuppliers } from './inventory.api';
import { usePurchaseProductSearch } from './usePurchaseProductSearch';
import { invalidatePurchaseQueries } from './invalidatePurchaseQueries';
import { useMetadata } from '@/services/metadata';
import type { ApiRecord } from '@/types/api';

export interface PurchaseDraftItem extends ApiRecord { quantity: number; unitCost: number }

/** Shared purchase state and validation; only the presentation differs by screen. */
export function usePurchaseOrderForm(listPath: string) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { notify } = useToast();
  const metadata = useMetadata();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PurchaseDraftItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const products = usePurchaseProductSearch(search);
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const due = Math.max(0, subtotal - discount + otherCost);
  const mutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async payload => {
      await invalidatePurchaseQueries(client);
      notify('Lưu phiếu thành công', `${payload.data.code} đã được lưu.`);
      navigate(listPath);
    },
    onError: error => notify('Không thể lưu phiếu', error.message),
  });

  const addItem = (item: ApiRecord) => {
    setItems(current => current.some(row => row.itemId === item.itemId)
      ? current.map(row => row.itemId === item.itemId ? { ...row, quantity: row.quantity + 1 } : row)
      : [...current, { ...item, quantity: 1, unitCost: item.lastPurchasePrice || item.costPrice || 0 }]);
    setSearch('');
  };
  const updateItem = (id: number, patch: Partial<PurchaseDraftItem>) => setItems(current => current.map(item => item.itemId === id ? { ...item, ...patch } : item));
  const removeItem = (id: number) => setItems(current => current.filter(item => item.itemId !== id));
  const save = (status: 'draft' | 'completed') => {
    if (mutation.isPending) return;
    if (!supplierId) return notify('Thiếu nhà cung cấp', 'Hãy chọn nhà cung cấp trước khi lưu phiếu.');
    if (!items.length) return notify('Phiếu nhập trống', 'Hãy thêm ít nhất một sản phẩm.');
    if (items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
      return notify('Dòng hàng không hợp lệ', 'Số lượng phải lớn hơn 0 và giá nhập không được âm.');
    }
    if (amountPaid > due) return notify('Tiền trả vượt giá trị phiếu', 'Tiền trả nhà cung cấp không được vượt số tiền cần trả.');
    mutation.mutate({ supplierId: Number(supplierId), status, discount, otherCost, amountPaid, paymentMethod, note,
      items: items.map(item => ({ productId: item.itemId, quantity: item.quantity, unitCost: item.unitCost, discount: 0 })),
    });
  };

  return { search, setSearch, items, supplierId, setSupplierId, discount, setDiscount, otherCost, setOtherCost,
    amountPaid, setAmountPaid, paymentMethod, setPaymentMethod, note, setNote,
    products, suppliers, metadata, mutation, subtotal, due, addItem, updateItem, removeItem, save,
    results: products.data?.data ?? [],
  };
}
