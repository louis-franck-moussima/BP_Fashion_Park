export type ProductCategory = string;
export type PriceMode = 'fixed' | 'from' | 'on-request';
export type ProductPublicationStatus =
  | 'draft'
  | 'published'
  | 'hidden'
  | 'archived';

export interface ProductColor {
  name: string;
  hex: string;
  stock?: number;
}

export interface ProductVariant {
  color: string;
  size: string;
  stock: number;
}

export interface WigDetails {
  length?: string;
  texture?: string;
  laceType?: string;
  density?: string;
}

export interface ProductPurchasingInfo {
  productId: string;
  supplierName?: string;
  supplierContact?: string;
  supplierReference?: string;
  purchaseCost?: number;
  purchaseDate?: string;
  batchReference?: string;
  notes?: string;
  updatedAt: number;
}

export type StockMovementReason = 'increase' | 'decrease' | 'restock';

export interface StockMovement {
  id: string;
  productId: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockMovementReason;
  color?: string;
  size?: string;
  createdAt: number;
}

export interface Product {
  id: string;
  status?: ProductPublicationStatus;
  name: string;
  sku?: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
  priceMode?: PriceMode;
  negotiable?: boolean;
  stock?: number;
  lowStockThreshold?: number;
  art: string;
  description: string;
  images: ProductImage[];
  colors: ProductColor[];
  sizes?: string[];
  variants?: ProductVariant[];
  audiences?: string[];
  ageRange?: string;
  tags?: string[];
  featured?: boolean;
  newArrival?: boolean;
  limitedQuantity?: boolean;
  relatedProductIds?: string[];
  wigDetails?: WigDetails;
  createdAt: number;
}

export interface ProductImage {
  url: string;
  publicId?: string;
  alt: string;
  color?: string;
}

export const totalStock = (product: Product) =>
  product.variants?.length
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : product.colors.some((color) => color.stock !== undefined)
    ? product.colors.reduce((sum, color) => sum + (color.stock ?? 0), 0)
    : product.stock ?? 0;

export const productStatus = (product: Product): ProductPublicationStatus =>
  product.status ?? 'published';

export const isProductPublished = (product: Product) =>
  productStatus(product) === 'published';

export const productPriceLabel = (product: Product) => {
  if (product.priceMode === 'on-request') return 'Price on request';
  return `${product.priceMode === 'from' ? 'From ' : ''}€${product.price}`;
};
