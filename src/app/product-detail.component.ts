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
  readonly visibleImages = computed(() => this.product()?.images ?? []);
  readonly totalStock = computed(() =>
    this.product() ? totalStock(this.product()!) : 0,
  );
  readonly selectedColorStock = computed(() => {
    const product = this.product();
    const color = this.selectedColor();
    const size = this.selectedSize();
    if (product?.variants?.length && color && size)
      return this.variantStock(color.name, size);
    if (product?.variants?.length && color)
      return product.variants
        .filter((variant) => variant.color === color.name)
        .reduce((sum, variant) => sum + variant.stock, 0);
    return color?.stock ?? this.totalStock();
  });
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
    const imageIndex = this.product()?.images.findIndex(
      (_, index) => this.imageColorAt(index)?.toLowerCase() === color.name.toLowerCase(),
    ) ?? -1;
    if (imageIndex >= 0) this.selectedImage.set(imageIndex);
    const product = this.product();
    if (product?.variants?.length)
      this.selectedSize.set(
        product.sizes?.find((size) => this.variantStock(color.name, size) > 0) ??
          product.sizes?.[0] ??
          null,
      );
  }
  selectGalleryImage(index: number): void {
    this.selectedImage.set(index);
    const colorName = this.imageColorAt(index);
    const color = this.product()?.colors.find(
      (item) => item.name.toLowerCase() === colorName?.toLowerCase(),
    );
    if (color) {
      this.selectedColor.set(color);
      const product = this.product();
      if (product?.variants?.length)
        this.selectedSize.set(
          product.sizes?.find((size) => this.variantStock(color.name, size) > 0) ??
            product.sizes?.[0] ??
            null,
        );
    }
  }
  imageColorAt(index: number): string | undefined {
    const product = this.product();
    if (!product) return undefined;
    const explicit = product.images[index]?.color;
    if (explicit) return explicit;
    return product.images.length === product.colors.length
      ? product.colors[index]?.name
      : undefined;
  }
  selectSize(size: string): void {
    if (this.isSizeAvailable(size)) this.selectedSize.set(size);
  }
  addToBag(): void {
    const product = this.product();
    const color = this.selectedColor();
    if (product && color && this.selectedColorStock() > 0)
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
  stockLabel(id: string): string {
    const product = this.store.findPublic(id);
    if (!product || totalStock(product) === 0) return 'Out of stock';
    if (totalStock(product) <= (product.lowStockThreshold ?? 3) || product.limitedQuantity)
      return 'Limited quantity';
    return 'Available';
  }
  colorStock(colorName: string): number {
    const product = this.product();
    if (!product) return 0;
    if (product.variants?.length)
      return product.variants
        .filter((variant) => variant.color === colorName)
        .reduce((sum, variant) => sum + variant.stock, 0);
    return product.colors.find((color) => color.name === colorName)?.stock ?? totalStock(product);
  }
  variantStock(colorName: string, size: string): number {
    return this.product()?.variants?.find(
      (variant) => variant.color === colorName && variant.size === size,
    )?.stock ?? 0;
  }
  isSizeAvailable(size: string): boolean {
    const product = this.product();
    const color = this.selectedColor();
    return !product?.variants?.length || !color || this.variantStock(color.name, size) > 0;
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
    this.selectedColor.set(
      product?.colors.find((color) => this.colorStock(color.name) > 0) ??
        product?.colors[0] ??
        null,
    );
  }
  private selectInitialSize(): void {
    const product = this.product();
    const color = this.selectedColor();
    this.selectedSize.set(
      product?.sizes?.find(
        (size) => !product.variants?.length || !color || this.variantStock(color.name, size) > 0,
      ) ?? product?.sizes?.[0] ?? null,
    );
  }

  private rootCategory(categoryId: string): string {
    return this.categoryStore.path(categoryId)[0]?.id ?? categoryId;
  }
}
