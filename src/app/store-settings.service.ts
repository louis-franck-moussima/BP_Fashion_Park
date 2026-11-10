import { Injectable, inject, signal } from '@angular/core';
import { Product } from './product.model';
import { DEFAULT_STORE_SETTINGS, StoreSettings } from './store-settings.model';
import { StoreSettingsRepository } from './store-settings-repository.service';

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private readonly repository = inject(StoreSettingsRepository);
  private initialized = false;
  readonly settings = signal<StoreSettings>({ ...DEFAULT_STORE_SETTINGS });
  readonly loading = signal(false);
  readonly error = signal('');

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.repository.configured) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const saved = await this.repository.get();
      if (saved) this.settings.set({ ...DEFAULT_STORE_SETTINGS, ...saved });
    } catch {
      this.error.set('Store settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(value: StoreSettings): Promise<void> {
    const settings = this.validate({ ...value, updatedAt: Date.now() });
    await this.repository.save(settings);
    this.settings.set(settings);
  }

  priceLabel(product: Product): string {
    if (product.priceMode === 'on-request') return 'Price on request';
    const formatted = this.formatMoney(product.price);
    return `${product.priceMode === 'from' ? 'From ' : ''}${formatted}`;
  }

  formatMoney(value: number): string {
    const { currency, defaultLanguage } = this.settings();
    return new Intl.NumberFormat(defaultLanguage === 'fr' ? 'fr-FR' : 'en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  whatsappUrl(message: string): string {
    const number = this.settings().whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  private validate(settings: StoreSettings): StoreSettings {
    const phone = settings.whatsappNumber.replace(/[\s()+-]/g, '');
    if (phone && !/^\d{6,20}$/.test(phone))
      throw new Error('WhatsApp number must use international format.');
    const socialUrls = [settings.instagramUrl, settings.facebookUrl, settings.tiktokUrl];
    if (socialUrls.some((url) => url && !/^https:\/\//i.test(url)))
      throw new Error('Social media URLs must begin with https://.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail))
      throw new Error('Enter a valid contact email.');
    if (!['EUR', 'USD', 'GBP', 'XOF', 'CDF'].includes(settings.currency))
      throw new Error('Choose a supported currency.');
    if (!['en', 'fr'].includes(settings.defaultLanguage))
      throw new Error('Choose a supported default language.');
    if (!settings.announcementText.trim())
      throw new Error('Homepage announcement cannot be empty.');
    if (
      settings.businessAddress.length > 300 ||
      settings.deliveryInformation.length > 600 ||
      settings.announcementText.length > 140
    )
      throw new Error('One or more settings fields are too long.');
    return { ...settings, whatsappNumber: phone };
  }
}
