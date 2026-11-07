import { Injectable, computed, signal } from '@angular/core';
import { Product, productPriceLabel } from './product.model';
import { environment } from '../environments/environment';

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
  readonly open = signal(false);
  readonly items = signal<CartItem[]>(this.restore());
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  add(product: Product, color: string, size = ''): void {
    const key = [product.id, color, size].join('|');
    const existing = this.items().find(item => item.key === key);
    this.items.update(items => existing
      ? items.map(item => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
      : [...items, {
          key, productId: product.id, name: product.name, category: product.category,
          imageUrl: product.images[0]?.url ?? '', color, size, quantity: 1,
          priceLabel: productPriceLabel(product)
        }]);
    this.persist();
    this.open.set(true);
  }

  changeQuantity(key: string, delta: number): void {
    this.items.update(items => items
      .map(item => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0));
    this.persist();
  }

  remove(key: string): void {
    this.items.update(items => items.filter(item => item.key !== key));
    this.persist();
  }

  readonly whatsappUrl = computed(() => {
    const lines = this.items().map(item =>
      `• ${item.quantity} × ${item.name} — ${item.color}${item.size ? ` — ${item.size}` : ''} — ${item.priceLabel}`);
    const message = ['Hello BP Fashion Park, I would like to check availability for:', '', ...lines, '', 'Please confirm availability, final price and delivery.'].join('\n');
    const number = environment.whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  });

  private restore(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const value = JSON.parse(window.localStorage.getItem('bp-fashion-request-bag') ?? '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  private persist(): void {
    if (typeof window !== 'undefined') window.localStorage.setItem('bp-fashion-request-bag', JSON.stringify(this.items()));
  }
}
