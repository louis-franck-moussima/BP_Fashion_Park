import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Product, ProductColor, totalStock } from './product.model';
import { ProductStore } from './product-store.service';
import { CategoryStore } from './category-store.service';
import { CartService } from './cart.service';
import { SeoService } from './seo.service';
import { StoreSettingsService } from './store-settings.service';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrls: [
    './product-detail.component.css',
    './product-detail-options.component.css',
  ],
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ProductStore);
  readonly categoryStore = inject(CategoryStore);
  readonly cart = inject(CartService);
  readonly storeSettings = inject(StoreSettingsService);
  private readonly seo = inject(SeoService);
  readonly catalogLoading = computed(
    () => this.store.loading() || this.categoryStore.loading(),
  );
  readonly catalogError = computed(
    () => this.store.loadError() || this.categoryStore.loadError(),
  );
  readonly productId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  readonly selectedImage = signal(0);
  readonly selectedColor = signal<ProductColor | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly product = computed(() => {
    const product = this.store.findPublic(this.productId());
    return product && this.categoryStore.isVisible(product.category)
      ? product
      : undefined;
  });
  readonly totalStock = computed(() =>
    this.product() ? totalStock(this.product()!) : 0,
  );
  priceLabel(product: Product): string {
    return this.storeSettings.priceLabel(product);
  }
  originalPriceLabel(product: Product): string {
    return product.originalPrice
      ? this.storeSettings.formatMoney(product.originalPrice)
      : '';
  }
  readonly recommendations = computed(() => {
    const current = this.product();
    if (!current) return [];
    if (current.relatedProductIds?.length) {
      return current.relatedProductIds
        .map((id) => this.store.findPublic(id))
        .filter(
          (item) =>
            Boolean(item) && this.categoryStore.isVisible(item!.category),
        )
        .slice(0, 4) as Product[];
    }
    const currentColors = new Set(
      current.colors.map((color) => color.name.toLowerCase()),
    );
    const currentRoot = this.rootCategory(current.category);
    return this.store
      .publicProducts()
      .filter(
        (item) =>
          item.id !== current.id && this.categoryStore.isVisible(item.category),
      )
      .map((item) => {
        let score = 0;
        if (item.category === current.category) score += 6;
        else if (this.rootCategory(item.category) === currentRoot) score += 4;
        score +=
          item.colors.filter((color) =>
            currentColors.has(color.name.toLowerCase()),
          ).length * 2;
        if (totalStock(item) > 0) score += 2;
        if (item.featured) score += 1;
        score += Math.max(0, 1 - Math.abs(item.price - current.price) / 100);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((result) => result.item);
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.productId.set(params.get('id') ?? '');
      this.selectedImage.set(0);
      this.selectInitialColor();
      this.selectInitialSize();
    });
    effect(() => {
      const product = this.product();
      if (product)
        this.seo.setProduct(
          product,
          this.categoryStore.pathLabel(product.category),
        );
      else if (!this.catalogLoading() && !this.catalogError())
        this.seo.setNotFound('Product');
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.store.initialize(),
      this.categoryStore.initialize(),
      this.storeSettings.initialize(),
    ]);
    this.selectInitialColor();
    this.selectInitialSize();
  }

  selectColor(color: ProductColor): void {
    this.selectedColor.set(color);
  }
  selectSize(size: string): void {
    this.selectedSize.set(size);
  }
  addToBag(): void {
    const product = this.product();
    const color = this.selectedColor();
    if (product && color && this.totalStock() > 0)
      this.cart.add(product, color.name, this.selectedSize() ?? '');
  }
  categoryName(id: string): string {
    return this.categoryStore.name(id);
  }
  productUrl(categoryId: string, productId: string): string {
    return this.categoryStore.productUrl(categoryId, productId);
  }
  stockOf(id: string): number {
    const product = this.store.findPublic(id);
    return product ? totalStock(product) : 0;
  }
  recommendationReason(categoryId: string): string {
    const current = this.product();
    if (!current) return 'Selected for you';
    if (categoryId === current.category)
      return `More ${this.categoryName(categoryId)}`;
    if (this.rootCategory(categoryId) === this.rootCategory(current.category))
      return 'A natural match';
    return 'Complete the look';
  }

  private selectInitialColor(): void {
    const product = this.product();
    this.selectedColor.set(product?.colors[0] ?? null);
  }
  private selectInitialSize(): void {
    this.selectedSize.set(this.product()?.sizes?.[0] ?? null);
  }

  private rootCategory(categoryId: string): string {
    return this.categoryStore.path(categoryId)[0]?.id ?? categoryId;
  }
}
