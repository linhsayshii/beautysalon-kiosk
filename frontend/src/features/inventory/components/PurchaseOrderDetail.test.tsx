import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as inventoryApi from '../inventory.api';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';

vi.mock('../inventory.api');

const order = {
  id: 1, code: 'PN000001', status: 'completed', supplier: { name: 'SkinCare Lab' }, createdBy: null,
  receivedAt: '2026-09-29T02:49:00Z', paymentMethod: 'cash', note: '', subtotal: 1000000, amountDue: 1000000, amountPaid: 600000,
  items: [{ id: 1, sku: 'QASP001', name: 'QA Serum', quantity: 5, unit: 'chai', unitCost: 200000, discount: 0, lineTotal: 1000000 }],
};

function renderDetail() {
  return render(<QueryClientProvider client={new QueryClient()}><PurchaseOrderDetail id={1} /></QueryClientProvider>);
}

describe('PurchaseOrderDetail', () => {
  it('shows only the supplier in the subtitle when nobody is recorded as creator', async () => {
    vi.mocked(inventoryApi.getPurchaseOrder).mockResolvedValue({ data: order, meta: {} });
    renderDetail();
    const meta = (await screen.findByText('PN000001')).closest('.detail-head')!.querySelector('.detail-head-meta')!;
    expect(meta.textContent).toBe('SkinCare Lab');
  });
  it('does not colour a zero discount red', async () => {
    vi.mocked(inventoryApi.getPurchaseOrder).mockResolvedValue({ data: order, meta: {} });
    renderDetail();
    const cell = (await screen.findByText('QA Serum')).closest('tr')!.querySelectorAll('td')[4];
    expect(cell).toHaveTextContent('0đ');
    expect(cell).not.toHaveClass('text-danger');
  });
});
