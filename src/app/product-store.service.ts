import { Injectable, computed, inject, signal } from '@angular/core';
import { isProductPublished, Product, ProductPublicationStatus, ProductPurchasingInfo, StockMovement, StockMovementReason } from './product.model';
import { ProductRepository } from './product-repository.service';
import { validateProduct } from './catalog-validation';

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'stone-tailored-trousers',
    name: 'Stone Tailored Trousers',
    category: 'men-trousers',
    price: 72,
    art: 'dress',
    description:
      'Clean-cut tailored trousers in a versatile stone tone, designed with a straight leg and a refined pressed crease for workdays and occasions.',
    images: [
      {
        url: '/products/stone-tailored-trousers.png',
        alt: 'Stone beige tailored trousers',
      },
    ],
    colors: [
      { name: 'Stone', hex: '#b7a087', stock: 6 },
      { name: 'Navy', hex: '#253342', stock: 3 },
      { name: 'Black', hex: '#242321', stock: 0 },
    ],
    featured: true,
    createdAt: 13,
  },
  {
    id: 'ivory-linen-shirt',
    name: 'Ivory Linen Shirt',
    category: 'men-shirts',
    price: 58,
    art: 'dress',
    description:
      'A breathable long-sleeve linen shirt with an easy relaxed cut, natural texture and polished collar for effortless warm-weather dressing.',
    images: [
      {
        url: '/products/ivory-linen-shirt.png',
        alt: 'Ivory long-sleeve linen shirt',
      },
    ],
    colors: [
      { name: 'Ivory', hex: '#eee7d7', stock: 8 },
      { name: 'Sage', hex: '#8e9880', stock: 4 },
      { name: 'Sky', hex: '#9fb8c8', stock: 0 },
    ],
    featured: true,
    createdAt: 12,
  },
  {
    id: 'terracotta-wrap-dress',
    name: 'Terracotta Wrap Dress',
    category: 'women-dresses',
    price: 86,
    art: 'dress',
    description:
      'A fluid midi dress with a flattering wrap front, soft flutter sleeves and a waist tie that moves beautifully from day to evening.',
    images: [
      {
        url: '/products/terracotta-wrap-dress.png',
        alt: 'Terracotta wrap midi dress',
      },
    ],
    colors: [
      { name: 'Terracotta', hex: '#b94f2f', stock: 5 },
      { name: 'Black', hex: '#262321', stock: 2 },
      { name: 'Cream', hex: '#e9decc', stock: 0 },
    ],
    featured: true,
    createdAt: 11,
  },
  {
    id: 'espresso-pleated-skirt',
    name: 'Espresso Pleated Skirt',
    category: 'women-skirts',
    price: 64,
    art: 'dress',
    description:
      'An elegant flowing midi skirt with crisp permanent pleats and a comfortable high waist, finished in a deep espresso brown.',
    images: [
      {
        url: '/products/espresso-pleated-skirt.png',
        alt: 'Espresso brown pleated midi skirt',
      },
    ],
    colors: [
      { name: 'Espresso', hex: '#553526', stock: 7 },
      { name: 'Sand', hex: '#c9ad87', stock: 3 },
      { name: 'Forest', hex: '#4f5c4e', stock: 0 },
    ],
    createdAt: 10,
  },
  {
    id: 'sienna-bag',
    name: 'Sienna Structured Bag',
    category: 'accessories-bags',
    price: 89,
    art: 'bag',
    description:
      'A polished everyday handbag crafted in rich pebbled leather, finished with brushed-gold hardware and a timeless structured silhouette.',
    images: [
      {
        url: '/products/sienna-structured-bag.png',
        alt: 'Sienna caramel leather structured handbag',
      },
    ],
    colors: [
      { name: 'Cognac', hex: '#a95725', stock: 6 },
      { name: 'Black', hex: '#24211f', stock: 2 },
      { name: 'Cream', hex: '#e7d8c4', stock: 0 },
    ],
    featured: true,
    createdAt: 9,
  },
  {
    id: 'golden-necklace',
    name: 'Golden Hour Necklace',
    category: 'accessories-jewelry',
    price: 42,
    art: 'necklace',
    description: 'A delicate gold-tone pendant for every occasion.',
    images: [],
    colors: [{ name: 'Gold', hex: '#b59252', stock: 8 }],
    featured: true,
    createdAt: 5,
  },
  {
    id: 'weekend-set',
    name: 'The Weekend Set',
    category: 'women-sets',
    price: 74,
    art: 'dress',
    description: 'An effortless matching set with a soft, relaxed shape.',
    images: [],
    colors: [
      { name: 'Ivory', hex: '#ead9c8', stock: 4 },
      { name: 'Terracotta', hex: '#ad5c40', stock: 0 },
    ],
    featured: true,
    createdAt: 4,
  },
  {
    id: 'voyager-case',
    name: 'Voyager Cabin Case',
    category: 'travel-suitcases',
    price: 149,
    art: 'case',
    description:
      'A refined champagne cabin suitcase with a ribbed shell, leather corner protection and smooth four-wheel movement for elegant short-haul travel.',
    images: [
      {
        url: '/products/voyager-cabin-case.png',
        alt: 'Voyager champagne cabin suitcase with brown leather trim',
      },
    ],
    colors: [
      { name: 'Champagne', hex: '#c9ad84', stock: 4 },
      { name: 'Espresso', hex: '#563625', stock: 2 },
      { name: 'Forest', hex: '#4e5a55', stock: 0 },
    ],
    featured: true,
    createdAt: 7,
  },
  {
    id: 'noir-loafer',
    name: 'Noir City Loafer',
    category: 'men-casual-shoes',
    price: 78,
    art: 'shoe',
    description:
      'A modern penny loafer in polished black leather, shaped with clean lines and fine stitching for effortless work-to-evening style.',
    images: [
      {
        url: '/products/noir-city-loafer.png',
        alt: 'Noir black leather penny loafer',
      },
    ],
    colors: [
      { name: 'Black', hex: '#191817', stock: 5 },
      { name: 'Cognac', hex: '#865032', stock: 2 },
    ],
    featured: true,
    createdAt: 8,
  },
  {
    id: 'soft-tote',
    name: 'Soft Form Tote',
    category: 'accessories-bags',
    price: 79,
    art: 'tote',
    description: 'A roomy soft tote for busy days and short escapes.',
    images: [],
    colors: [
      { name: 'Cream', hex: '#ece2d1', stock: 7 },
      { name: 'Chocolate', hex: '#584136', stock: 3 },
    ],
    createdAt: 1,
  },
];

@Injectable({ providedIn: 'root' })
export class ProductStore {
  private readonly repository = inject(ProductRepository);
  private initialized = false;
  readonly products = signal<Product[]>(
    this.repository.firebaseConfigured ? [] : DEMO_PRODUCTS,
  );
  readonly publicProducts = computed(() =>
    this.products().filter(isProductPublished),
  );
  readonly firebaseConfigured = this.repository.firebaseConfigured;
  readonly loading = signal(this.firebaseConfigured);
  readonly loadError = signal('');
  readonly stockHistory = signal<StockMovement[]>([]);
  readonly recentStockChanges = signal<StockMovement[]>([]);
  readonly purchasingInfo = signal<Record<string, ProductPurchasingInfo>>({});
  readonly historyLoading = signal(false);
  readonly historyError = signal('');

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.firebaseConfigured) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.products.set(await this.repository.list());
    } catch {
      this.products.set([]);
      this.loadError.set('Products could not be loaded from the live catalog.');
    } finally {
      this.loading.set(false);
    }
  }

  find(id: string): Product | undefined {
    return this.products().find((product) => product.id === id);
  }

  findPublic(id: string): Product | undefined {
    const product = this.find(id);
    return product && isProductPublished(product) ? product : undefined;
  }

  async save(product: Product): Promise<void> {
    const errors = validateProduct(product);
    if (errors.length) throw new Error(errors.join(' '));
    const exists = this.find(product.id);
    await this.repository.save(product);
    this.products.update((items) =>
      exists
        ? items.map((item) => (item.id === product.id ? product : item))
        : [product, ...items],
    );
  }

  async savePurchasingInfo(info: ProductPurchasingInfo): Promise<void> {
    await this.repository.savePurchasingInfo(info);
    this.purchasingInfo.update((items) => ({ ...items, [info.productId]: info }));
  }

  async loadPurchasingInfo(): Promise<void> {
    if (!this.firebaseConfigured) return;
    const purchasing = await this.repository.listPurchasingInfo();
    this.purchasingInfo.set(
      Object.fromEntries(purchasing.map((info) => [info.productId, info])),
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.products.update((items) => items.filter((item) => item.id !== id));
    this.purchasingInfo.update((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
  }

  async adjustStock(
    productId: string,
    delta: number,
    reason: StockMovementReason,
    colorName?: string,
    sizeName?: string,
  ): Promise<void> {
    const movement = await this.repository.adjustStock(
      productId,
      delta,
      reason,
      colorName,
      sizeName,
    );
    this.products.update((items) =>
      items.map((item) =>
        item.id === productId
          ? movement.color && movement.size
            ? {
                ...item,
                variants: item.variants?.map((variant) =>
                  variant.color === movement.color && variant.size === movement.size
                    ? { ...variant, stock: variant.stock + movement.delta }
                    : variant,
                ),
              }
            : movement.color
            ? {
                ...item,
                colors: item.colors.map((color) =>
                  color.name === movement.color
                    ? { ...color, stock: (color.stock ?? 0) + movement.delta }
                    : color,
                ),
              }
            : { ...item, stock: movement.newStock }
          : item,
      ),
    );
    this.stockHistory.update((items) =>
      items[0]?.productId === productId
        ? [movement, ...items].slice(0, 30)
        : items,
    );
    this.recentStockChanges.update((items) => [movement, ...items].slice(0, 20));
  }

  async applyInventoryChange(
    productId: string,
    stock: number,
    status: ProductPublicationStatus,
    lowStockThreshold: number,
    price: number,
  ): Promise<void> {
    const result = await this.repository.applyInventoryChange(
      productId,
      stock,
      status,
      lowStockThreshold,
      price,
    );
    this.products.update((items) =>
      items.map((item) => (item.id === productId ? result.product : item)),
    );
    if (result.movement) {
      this.stockHistory.update((items) => [result.movement!, ...items].slice(0, 30));
      this.recentStockChanges.update((items) => [result.movement!, ...items].slice(0, 20));
    }
  }

  async loadStockHistory(productId: string): Promise<void> {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.stockHistory.set([]);
    try {
      this.stockHistory.set(await this.repository.stockHistory(productId));
    } catch {
      this.historyError.set('Stock history could not be loaded.');
    } finally {
      this.historyLoading.set(false);
    }
  }

  async loadRecentStockHistory(): Promise<void> {
    if (!this.firebaseConfigured) return;
    try {
      this.recentStockChanges.set(await this.repository.recentStockHistory());
    } catch {
      this.recentStockChanges.set([]);
    }
  }

  clearStockHistory(): void {
    this.stockHistory.set([]);
    this.historyError.set('');
  }
}
