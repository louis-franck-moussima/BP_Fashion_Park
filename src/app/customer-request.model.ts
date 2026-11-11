export type CustomerRequestStatus =
  'new' | 'contacted' | 'confirmed' | 'closed';

export interface CustomerRequestItem {
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  priceLabel: string;
  unitPrice?: number;
  currency?: string;
  priceMode?: 'fixed' | 'from' | 'on-request';
  negotiable?: boolean;
  imageUrl?: string;
}

export interface CustomerRequest {
  id: string;
  reference: string;
  name: string;
  phone: string;
  city: string;
  message: string;
  items: CustomerRequestItem[];
  status: CustomerRequestStatus;
  ownerNotes?: string;
  followUpAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
