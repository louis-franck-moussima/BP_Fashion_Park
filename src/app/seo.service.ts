import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Category } from './category.model';
import { Product, totalStock } from './product.model';
import { StoreSettingsService } from './store-settings.service';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly storeSettings = inject(StoreSettingsService);
  private readonly brand = 'BP Fashion Park';

  setHome(): void {
    this.apply(
      'BP Fashion Park | Fashion, Shoes & Accessories',
      'Discover selected clothing, shoes, wigs, bags, jewelry and travel essentials for women, men and children.',
      'website',
    );
  }

  setContact(): void {
    this.apply(
      `Contact & Location | ${this.brand}`,
      'Contact BP Fashion Park about product availability, sizing, delivery and visiting the shop.',
      'website',
    );
  }

  setCategory(category: Category, path: Category[]): void {
    const pathLabel = path.map((item) => item.name).join(' · ');
    const description =
      category.description ||
      `Explore the latest ${category.name.toLowerCase()} available from BP Fashion Park.`;
    this.apply(`Shop ${pathLabel} | ${this.brand}`, description, 'website');
  }

  setProduct(product: Product, categoryName: string): void {
    const availability =
      totalStock(product) > 0 ? 'Available now' : 'Currently out of stock';
    const description = `${product.description} ${this.storeSettings.priceLabel(product)}. ${availability} in ${categoryName}.`;
    const image = product.images.find((item) =>
      /^https:\/\//i.test(item.url),
    )?.url;
    this.apply(
      `${product.name} | ${this.brand}`,
      description,
      'product',
      image,
    );
  }

  setNotFound(kind: 'Product' | 'Collection'): void {
    this.apply(
      `${kind} not found | ${this.brand}`,
      `This ${kind.toLowerCase()} is unavailable or may have been moved.`,
      'website',
      undefined,
      false,
    );
  }

  private apply(
    title: string,
    description: string,
    type: string,
    image?: string,
    index = true,
  ): void {
    const safeTitle = this.clamp(title, 65);
    const safeDescription = this.clamp(
      description.replace(/\s+/g, ' ').trim(),
      160,
    );
    this.title.setTitle(safeTitle);
    this.meta.updateTag({ name: 'description', content: safeDescription });
    this.meta.updateTag({
      name: 'robots',
      content: index ? 'index, follow' : 'noindex, nofollow',
    });
    this.meta.updateTag({ property: 'og:site_name', content: this.brand });
    this.meta.updateTag({ property: 'og:title', content: safeTitle });
    this.meta.updateTag({
      property: 'og:description',
      content: safeDescription,
    });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    });
    this.meta.updateTag({ name: 'twitter:title', content: safeTitle });
    this.meta.updateTag({
      name: 'twitter:description',
      content: safeDescription,
    });
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
      this.meta.updateTag({ name: 'twitter:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
      this.meta.removeTag("name='twitter:image'");
    }
  }

  private clamp(value: string, maximum: number): string {
    if (value.length <= maximum) return value;
    return `${value.slice(0, maximum - 1).trimEnd()}…`;
  }
}
