import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { CategoryStore } from './category-store.service';
import { ProductStore } from './product-store.service';
import {
  PriceMode,
  Product,
  ProductImage,
  productPriceLabel,
  totalStock,
} from './product.model';
import { CloudinaryService } from './cloudinary.service';
import { Category } from './category.model';
import { validateCategory, validateProduct } from './catalog-validation';

type AdminSection = 'overview' | 'products' | 'categories';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: [
    './admin-dashboard.component.css',
    './admin-dashboard-editor.component.css',
    './admin-category-visibility.component.css',
  ],
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AdminAuthService);
  readonly productStore = inject(ProductStore);
  readonly categoryStore = inject(CategoryStore);
  private readonly router = inject(Router);
  private readonly cloudinary = inject(CloudinaryService);
  readonly section = signal<AdminSection>('overview');
  readonly products = this.productStore.products;
  readonly totalUnits = computed(() =>
    this.products().reduce((sum, product) => sum + totalStock(product), 0),
  );
  readonly outOfStock = computed(() =>
    this.products().filter((product) => totalStock(product) === 0),
  );
  readonly lowStock = computed(() =>
    this.products().filter((product) => {
      const stock = totalStock(product);
      return stock > 0 && stock <= 3;
    }),
  );
  readonly inventoryValue = computed(() =>
    this.products().reduce(
      (sum, product) => sum + product.price * totalStock(product),
      0,
    ),
  );
  readonly recentProducts = computed(() =>
    [...this.products()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
  );
  readonly stockOf = totalStock;
  readonly priceLabel = productPriceLabel;
  readonly productEditorOpen = signal(false);
  readonly editingProductId = signal<string | null>(null);
  readonly pendingImages = signal<ProductImage[]>([]);
  readonly uploadingImages = signal(false);
  readonly savingProduct = signal(false);
  readonly formError = signal('');
  readonly categoryError = signal('');
  readonly importingStarterCategories = signal(false);
  readonly allCategories = computed(() =>
    [...this.categoryStore.categories()].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    ),
  );
  readonly catalogLoading = computed(
    () => this.productStore.loading() || this.categoryStore.loading(),
  );
  readonly catalogError = computed(
    () => this.productStore.loadError() || this.categoryStore.loadError(),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.productStore.initialize(),
      this.categoryStore.initialize(),
    ]);
  }
  categoryName(id: string): string {
    return this.categoryStore.name(id);
  }
  categoryPath(id: string): string {
    return (
      '/' +
      this.categoryStore
        .path(id)
        .map((category) => category.slug)
        .join('/')
    );
  }
  categoryDepth(id: string): number {
    return Math.max(0, this.categoryStore.path(id).length - 1);
  }
  categoryProductCount(id: string): number {
    const ids = new Set([
      id,
      ...this.categoryStore.descendants(id).map((category) => category.id),
    ]);
    return this.products().filter((product) => ids.has(product.category))
      .length;
  }
  newProduct(): void {
    if (!this.auth.user()) return;
    this.editingProductId.set(null);
    this.pendingImages.set([]);
    this.formError.set('');
    this.productEditorOpen.set(true);
  }
  editProduct(product: Product): void {
    if (!this.auth.user()) return;
    this.editingProductId.set(product.id);
    this.pendingImages.set([...(product.images ?? [])]);
    this.formError.set('');
    this.productEditorOpen.set(true);
    setTimeout(() => this.fillProductForm(product));
  }
  closeProductEditor(): void {
    this.productEditorOpen.set(false);
    this.formError.set('');
  }
  async selectImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (!files.length) return;
    this.uploadingImages.set(true);
    this.formError.set('');
    try {
      const name =
        document.querySelector<HTMLInputElement>(
          '.dashboard-product-form input[name="name"]',
        )?.value || 'Product';
      const images = await this.cloudinary.uploadMany(files, name);
      this.pendingImages.update((current) => [...current, ...images]);
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'Image upload failed.',
      );
    } finally {
      this.uploadingImages.set(false);
      input.value = '';
    }
  }
  removeImage(index: number): void {
    this.pendingImages.update((images) => images.filter((_, i) => i !== index));
  }
  moveImage(index: number, direction: -1 | 1): void {
    this.pendingImages.update((images) => {
      const target = index + direction;
      if (target < 0 || target >= images.length) return images;
      const result = [...images];
      [result[index], result[target]] = [result[target], result[index]];
      return result;
    });
  }
  async saveProduct(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.auth.user()) return;
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity()) {
      this.formError.set('Correct the highlighted fields before saving.');
      return;
    }
    const data = new FormData(form);
    const existing = this.editingProductId()
      ? this.productStore.find(this.editingProductId()!)
      : undefined;
    const product: Product = {
      id: existing?.id ?? `product-${Date.now()}`,
      name: String(data.get('name') || '').trim(),
      category: String(data.get('category') || ''),
      price: Number(data.get('price')),
      priceMode: String(data.get('priceMode') || 'fixed') as PriceMode,
      negotiable: data.get('negotiable') === 'on',
      stock: Math.max(0, Number(data.get('stock')) || 0),
      art: String(data.get('art') || 'dress'),
      description: String(data.get('description') || '').trim(),
      images: this.pendingImages(),
      colors: this.parseColors(String(data.get('colors') || '')),
      sizes: this.parseList(String(data.get('sizes') || '')),
      audiences: this.parseList(String(data.get('audiences') || '')),
      ageRange: String(data.get('ageRange') || '').trim(),
      tags: this.parseList(String(data.get('tags') || '')),
      featured: data.get('featured') === 'on',
      createdAt: existing?.createdAt ?? Date.now(),
    };
    const validationErrors = validateProduct(
      product,
      new Set(this.categoryStore.active().map((category) => category.id)),
    );
    if (validationErrors.length) {
      this.formError.set(validationErrors.join(' '));
      return;
    }
    this.savingProduct.set(true);
    this.formError.set('');
    try {
      await this.productStore.save(product);
      this.closeProductEditor();
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'Could not save this product.',
      );
    } finally {
      this.savingProduct.set(false);
    }
  }
  async deleteProduct(): Promise<void> {
    if (!this.auth.user() || !this.editingProductId()) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this product permanently?')
    )
      return;
    await this.productStore.remove(this.editingProductId()!);
    this.closeProductEditor();
  }
  async addCategory(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.auth.user()) return;
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity()) {
      this.categoryError.set('Correct the highlighted category fields.');
      return;
    }
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const parentCategoryId = String(data.get('parentCategoryId') || '') || null;
    const slug = this.slugify(name);
    const id = parentCategoryId ? `${parentCategoryId}-${slug}` : slug;
    const category: Category = {
      id,
      name,
      slug,
      description: String(data.get('description') || '').trim(),
      parentCategoryId,
      active: true,
      displayOrder: this.categoryStore.categories().length + 1,
    };
    const validationErrors = validateCategory(
      category,
      this.categoryStore.categories(),
    );
    if (validationErrors.length) {
      this.categoryError.set(validationErrors.join(' '));
      return;
    }
    try {
      await this.categoryStore.save(category);
      form.reset();
      this.categoryError.set('');
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Could not save this category.',
      );
    }
  }
  async toggleCategory(category: Category): Promise<void> {
    if (this.auth.user())
      await this.categoryStore.save({ ...category, active: !category.active });
  }
  async importStarterCategories(): Promise<void> {
    if (!this.auth.user() || this.categoryStore.categories().length) return;
    this.importingStarterCategories.set(true);
    this.categoryError.set('');
    try {
      await this.categoryStore.seedStarterCategories();
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Could not import the starter categories.',
      );
    } finally {
      this.importingStarterCategories.set(false);
    }
  }
  async setCategoryVisibility(
    category: Category,
    active: boolean,
  ): Promise<void> {
    if (this.auth.user())
      await this.categoryStore.save({ ...category, active });
  }
  async moveCategory(category: Category, direction: -1 | 1): Promise<void> {
    if (!this.auth.user()) return;
    const siblings = this.categoryStore
      .categories()
      .filter((item) => item.parentCategoryId === category.parentCategoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((item) => item.id === category.id);
    const other = siblings[index + direction];
    if (!other) return;
    await Promise.all([
      this.categoryStore.save({
        ...category,
        displayOrder: other.displayOrder,
      }),
      this.categoryStore.save({
        ...other,
        displayOrder: category.displayOrder,
      }),
    ]);
  }
  async deleteCategory(category: Category): Promise<void> {
    if (!this.auth.user()) return;
    const ids = new Set([
      category.id,
      ...this.categoryStore.descendants(category.id).map((item) => item.id),
    ]);
    if (this.products().some((product) => ids.has(product.category))) {
      this.categoryError.set(
        'Move the products from this category branch before deleting it.',
      );
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Delete ${category.name} and all of its empty subcategories?`,
      )
    )
      return;
    await this.categoryStore.remove(category.id);
    this.categoryError.set('');
  }
  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/admin/login']);
  }

  private parseColors(value: string) {
    return value
      .split(',')
      .map((entry) => {
        const [name = '', hex = ''] = entry.trim().split('|');
        return { name: name.trim(), hex: hex.trim() };
      })
      .filter((color) => color.name || color.hex);
  }
  private fillProductForm(product: Product): void {
    const form = document.querySelector<HTMLFormElement>(
      '.dashboard-product-form',
    );
    if (!form) return;
    (form.elements.namedItem('name') as HTMLInputElement).value = product.name;
    (form.elements.namedItem('category') as HTMLSelectElement).value =
      product.category;
    (form.elements.namedItem('price') as HTMLInputElement).value = String(
      product.price,
    );
    (form.elements.namedItem('priceMode') as HTMLSelectElement).value =
      product.priceMode ?? 'fixed';
    (form.elements.namedItem('negotiable') as HTMLInputElement).checked =
      Boolean(product.negotiable);
    (form.elements.namedItem('stock') as HTMLInputElement).value = String(
      totalStock(product),
    );
    (form.elements.namedItem('art') as HTMLSelectElement).value = product.art;
    (form.elements.namedItem('description') as HTMLTextAreaElement).value =
      product.description;
    (form.elements.namedItem('colors') as HTMLInputElement).value =
      product.colors.map((color) => `${color.name}|${color.hex}`).join(', ');
    (form.elements.namedItem('sizes') as HTMLInputElement).value = (
      product.sizes ?? []
    ).join(', ');
    (form.elements.namedItem('audiences') as HTMLInputElement).value = (
      product.audiences ?? []
    ).join(', ');
    (form.elements.namedItem('ageRange') as HTMLInputElement).value =
      product.ageRange ?? '';
    (form.elements.namedItem('tags') as HTMLInputElement).value = (
      product.tags ?? []
    ).join(', ');
    (form.elements.namedItem('featured') as HTMLInputElement).checked = Boolean(
      product.featured,
    );
  }
  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  private parseList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
