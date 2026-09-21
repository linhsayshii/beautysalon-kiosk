import { useRef } from 'react';
import { apiRequest, type ApiEnvelope } from '@/services/api-client';

export interface CustomerDebt {
  balance: number;
  openingDebt: number;
  invoices: Array<{id: number; code: string; total: number; amountPaid: number; debtAmount: number; issuedAt: string}>;
  entries: Array<{id: number; kind: string; amount: number; balanceAfter: number; invoiceCode: string | null; actorName: string | null; paymentMethod: string | null; note: string | null; allocations?: Array<{invoiceCode:string | null; amount:number}>; createdAt: string}>;
}
export const getCustomerDebt = (id: number) => apiRequest<ApiEnvelope<CustomerDebt>>(`/debts/${id}`);
export const collectCustomerDebt = (id: number, body: {amount: number; paymentMethod: string; invoiceId: number | null; note: string; requestKey: string}) =>
  apiRequest<ApiEnvelope<{paymentId: number; amount: number; balance: number}>>(`/debts/${id}/payments`, {method:'POST',body:JSON.stringify(body)});

// Retrying the same payload within a form reuses its key, including after timeout.
export function usePaymentRequestKey() {
  const keys = useRef(new Map<string,string>());
  return (payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, crypto.randomUUID());
    return keys.current.get(fingerprint)!;
  };
}
