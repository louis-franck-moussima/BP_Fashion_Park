import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Category } from './category.model';
import { CategoryStore } from './category-store.service';
import { ProductStore } from './product-store.service';
import { Product, totalStock } from './product.model';
import { SeoService } from './seo.service';
import { StoreSettingsService } from './store-settings.service';

@Component({
  selector: 'app-category-page',
  imports: [RouterLink],
  templateUrl: './category-page.component.html',
  styleUrls: [
    './category-page.component.css',
    './category-page-landing.component.css',
  ],
})
export class CategoryPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  readonly categoryStore = inject(CategoryStore);
  readonly productStore = inject(ProductStore);
  readonly storeSettings = inject(StoreSettingsService);
  readonly category = signal<Category | undefined>(undefined);
  readonly resolved = signal(false);
  readonly catalogLoading = computed(
    () => this.categoryStore.loading() || this.productStore.loading(),
  );
  readonly catalogError = computed(
    () => this.categoryStore.loadError() || this.productStore.loadError(),
  );
  readonly children = computed(() =>
    this.category() ? this.categoryStore.children(this.category()!.id) : [],
  );
  readonly breadcrumbs = computed(() =>
    this.category() ? this.categoryStore.path(this.category()!.id) : [],
  );
  readonly products = computed(() => {
    const category = this.category();
    if (!category) return [];
    const ids = new Set([
      category.id,
      ...this.categoryStore.descendants(category.id).map((item) => item.id),
    ]);
    return this.productStore
      .products()
      .filter((product) => ids.has(product.category));
  });
  readonly stockOf = totalStock;
  priceLabel(product: Product): string {
    return this.storeSettings.priceLabel(product);
  }
  originalPriceLabel(product: Product): string {
    return product.originalPrice
      ? this.storeSettings.formatMoney(product.originalPrice)
      : '';
  }

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.resolveCategory());
    effect(() => {
      const category = this.category();
      if (category)
        this.seo.setCategory(category, this.categoryStore.path(category.id));
      else if (
        this.resolved() &&
        !this.catalogLoading() &&
        !this.catalogError()
      )
        this.seo.setNotFound('Collection');
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.categoryStore.initialize(),
      this.productStore.initialize(),
      this.storeSettings.initialize(),
    ]);
    this.resolveCategory();
  }

  categoryUrl(id: string): string {
    return this.categoryStore.url(id);
  }
  openProduct(id: string): void {
    const product = this.productStore.find(id);
    if (product)
      this.router.navigateByUrl(
        this.categoryStore.productUrl(product.category, product.id),
      );
  }

  private resolveCategory(): void {
    const segments = this.router.url
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    this.category.set(this.categoryStore.findByPath(segments));
    this.resolved.set(true);
  }
}
