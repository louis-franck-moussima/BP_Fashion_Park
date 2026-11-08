export type ProductCategory = string;
export type PriceMode = 'fixed' | 'from' | 'on-request';

export interface ProductColor {
  name: string;
  hex: string;
  stock?: number;
}

export interface WigDetails {
  length?: string;
  texture?: string;
  laceType?: string;
  density?: string;
}

export type StockMovementReason = 'increase' | 'decrease' | 'restock';

export interface StockMovement {
  id: string;
  productId: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockMovementReason;
  createdAt: number;
}

export interface Product {
  id: string;
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
}

export const totalStock = (product: Product) =>
  product.stock ??
  product.colors.reduce((sum, color) => sum + (color.stock ?? 0), 0);

export const productPriceLabel = (product: Product) => {
  if (product.priceMode === 'on-request') return 'Price on request';
  return `${product.priceMode === 'from' ? 'From ' : ''}€${product.price}`;
};
