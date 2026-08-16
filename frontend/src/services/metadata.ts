import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client';
import type { ApiEnvelope } from './api-client';

export interface DomainMetadata {
  filters: {
    orders: { statuses: string[]; paymentMethods: string[] };
    customers: { debtStatuses: string[] };
    customerPackages: { statuses: string[] };
    products: { types: string[]; stockStatuses: string[]; statuses: string[] };
    purchaseOrders: { statuses: string[]; paymentMethods: string[] };
  };
  system?: {
    storeName: string;
    adminName: string;
    vietqr: {
      bankBin: string;
      accountNumber: string;
      accountName: string;
    };
  };
}

const getMetadata = () => apiRequest<ApiEnvelope<DomainMetadata>>('/meta');

export function useMetadata() {
  return useQuery({ queryKey: ['domain-metadata'], queryFn: getMetadata, staleTime: Infinity });
}

export const toOptions = (values: string[], labels: Record<string, string>) => values.map((value) => ({ value, label: labels[value] ?? value }));
