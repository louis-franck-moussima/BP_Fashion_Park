export type ProductCategory = string;
export type PriceMode = 'fixed' | 'from' | 'on-request';

export interface ProductColor {
  name: string;
  hex: string;
  stock?: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  priceMode?: PriceMode;
  negotiable?: boolean;
  stock?: number;
  art: string;
  description: string;
  images: ProductImage[];
  colors: ProductColor[];
  sizes?: string[];
  audiences?: string[];
  ageRange?: string;
  tags?: string[];
  featured?: boolean;
  createdAt: number;
}

export interface ProductImage {
  url: string;
  publicId?: string;
  alt: string;
}

export const totalStock = (product: Product) =>
  product.stock ?? product.colors.reduce((sum, color) => sum + (color.stock ?? 0), 0);

export const productPriceLabel = (product: Product) => {
  if (product.priceMode === 'on-request') return 'Price on request';
  return `${product.priceMode === 'from' ? 'From ' : ''}€${product.price}`;
};
