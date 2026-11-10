import { Injectable, computed, inject, signal } from '@angular/core';
import { Product } from './product.model';
import { CustomerRequest } from './customer-request.model';
import { StoreSettingsService } from './store-settings.service';

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  category: string;
  imageUrl: string;
  color: string;
  size: string;
  quantity: number;
  priceLabel: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storeSettings = inject(StoreSettingsService);
  readonly open = signal(false);
  readonly items = signal<CartItem[]>(this.restore());
  readonly count = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );

  add(product: Product, color: string, size = ''): void {
    const key = [product.id, color, size].join('|');
    const existing = this.items().find((item) => item.key === key);
    this.items.update((items) =>
      existing
        ? items.map((item) =>
            item.key === key
              ? {
                  ...item,
                  imageUrl: this.imageForColor(product, color),
                  quantity: item.quantity + 1,
                }
              : item,
          )
        : [
            ...items,
            {
              key,
              productId: product.id,
              name: product.name,
              category: product.category,
              imageUrl: this.imageForColor(product, color),
              color,
              size,
              quantity: 1,
              priceLabel: this.storeSettings.priceLabel(product),
            },
          ],
    );
    this.persist();
    this.open.set(true);
  }

  private imageForColor(product: Product, color: string): string {
    const explicit = product.images.find(
      (image) => image.color?.toLowerCase() === color.toLowerCase(),
    );
    if (explicit) return explicit.url;
    if (product.images.length === product.colors.length) {
      const index = product.colors.findIndex(
        (item) => item.name.toLowerCase() === color.toLowerCase(),
      );
      if (index >= 0) return product.images[index]?.url ?? '';
    }
    return product.images[0]?.url ?? '';
  }

  changeQuantity(key: string, delta: number): void {
    this.items.update((items) =>
      items
        .map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    this.persist();
  }

  remove(key: string): void {
    this.items.update((items) => items.filter((item) => item.key !== key));
    this.persist();
  }

  clear(): void {
    this.items.set([]);
    this.persist();
  }

  whatsappUrlFor(request: CustomerRequest): string {
    const lines = request.items.map(
      (item) =>
        `• ${item.quantity} × ${item.name} — ${item.color}${item.size ? ` — ${item.size}` : ''} — ${item.priceLabel}`,
    );
    const message = [
      `Hello BP Fashion Park, my request reference is ${request.reference}.`,
      `Name: ${request.name}`,
      `Phone: ${request.phone}`,
      `City: ${request.city}`,
      request.message ? `Message: ${request.message}` : '',
      '',
      ...lines,
      '',
      'Please confirm availability, final price and delivery.',
    ]
      .filter(Boolean)
      .join('\n');
    return this.storeSettings.whatsappUrl(message);
  }

  readonly whatsappUrl = computed(() => {
    const lines = this.items().map(
      (item) =>
        `• ${item.quantity} × ${item.name} — ${item.color}${item.size ? ` — ${item.size}` : ''} — ${item.priceLabel}`,
    );
    const message = [
      'Hello BP Fashion Park, I would like to check availability for:',
      '',
      ...lines,
      '',
      'Please confirm availability, final price and delivery.',
    ].join('\n');
    return this.storeSettings.whatsappUrl(message);
  });

  private restore(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const value = JSON.parse(
        window.localStorage.getItem('bp-fashion-request-bag') ?? '[]',
      );
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(
        'bp-fashion-request-bag',
        JSON.stringify(this.items()),
      );
  }
}
