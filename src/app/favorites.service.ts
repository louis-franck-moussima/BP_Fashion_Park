import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly storageKey = 'bp-fashion-favorites';
  readonly ids = signal<string[]>(this.restore());
  readonly count = computed(() => this.ids().length);

  has(productId: string): boolean {
    return this.ids().includes(productId);
  }

  toggle(productId: string): void {
    this.ids.update(ids => ids.includes(productId)
      ? ids.filter(id => id !== productId)
      : [...ids, productId]);
    this.persist();
  }

  remove(productId: string): void {
    this.ids.update(ids => ids.filter(id => id !== productId));
    this.persist();
  }

  private restore(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
      return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined')
      localStorage.setItem(this.storageKey, JSON.stringify(this.ids()));
  }
}
