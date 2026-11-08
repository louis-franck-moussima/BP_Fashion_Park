import {
  Component,
  OnInit,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { CategoryStore } from './category-store.service';
import { ProductStore } from './product-store.service';
import {
  PriceMode,
  Product,
  ProductImage,
  StockMovement,
  StockMovementReason,
  totalStock,
} from './product.model';
import { CloudinaryService } from './cloudinary.service';
import { Category } from './category.model';
import { validateCategory, validateProduct } from './catalog-validation';
import { CustomerRequestStore } from './customer-request-store.service';
import {
  CustomerRequest,
  CustomerRequestStatus,
} from './customer-request.model';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettings } from './store-settings.model';

type AdminSection =
  'overview' | 'products' | 'categories' | 'requests' | 'settings';

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
  readonly requestStore = inject(CustomerRequestStore);
  readonly storeSettings = inject(StoreSettingsService);
  private readonly router = inject(Router);
  private readonly cloudinary = inject(CloudinaryService);
  readonly section = signal<AdminSection>('overview');
  readonly sectionTitle = computed(
    () =>
      ({
        overview: 'Dashboard',
        products: 'Products',
        categories: 'Categories',
        requests: 'Customer requests',
        settings: 'Store settings',
      })[this.section()],
  );
  readonly newRequestCount = computed(
    () =>
      this.requestStore.requests().filter((request) => request.status === 'new')
        .length,
  );
  readonly products = this.productStore.products;
  readonly totalUnits = computed(() =>
    this.products().reduce((sum, product) => sum + totalStock(product), 0),
  );
  readonly outOfStock = computed(() =>
    this.products().filter((product) => totalStock(product) === 0),
  );
  readonly lowStock = computed(() =>
    this.products().filter((product) => this.isLowStock(product)),
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
  readonly savingSettings = signal(false);
  readonly settingsMessage = signal('');
  readonly productEditorOpen = signal(false);
  readonly editingProductId = signal<string | null>(null);
  readonly pendingImages = signal<ProductImage[]>([]);
  readonly removedImages = signal<ProductImage[]>([]);
  readonly uploadedThisSession = signal<ProductImage[]>([]);
  readonly productEditorDirty = signal(false);
  readonly adminNotice = signal('');
  readonly adminNoticeError = signal(false);
  readonly uploadingImages = signal(false);
  readonly savingProduct = signal(false);
  readonly formError = signal('');
  readonly inventoryError = signal('');
  readonly stockActionId = signal<string | null>(null);
  readonly requestActionId = signal<string | null>(null);
  readonly requestError = signal('');
  readonly categoryError = signal('');
  readonly editingCategoryId = signal<string | null>(null);
  readonly importingStarterCategories = signal(false);
  readonly allCategories = computed(() =>
    [...this.categoryStore.categories()].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    ),
  );
  readonly availableCategoryParents = computed(() => {
    const editingId = this.editingCategoryId();
    if (!editingId) return this.allCategories();
    return this.allCategories().filter(
      (category) =>
        category.id !== editingId &&
        !this.categoryStore
          .path(category.id)
          .some((item) => item.id === editingId),
    );
  });
  readonly catalogLoading = computed(
    () => this.productStore.loading() || this.categoryStore.loading(),
  );
  readonly catalogError = computed(
    () => this.productStore.loadError() || this.categoryStore.loadError(),
  );

  constructor() {
    effect(() => {
      if (this.auth.user()) void this.requestStore.initialize();
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.productStore.initialize(),
      this.categoryStore.initialize(),
      this.storeSettings.initialize(),
    ]);
  }
  categoryName(id: string): string {
    return this.categoryStore.name(id);
  }
  priceLabel(product: Product): string {
    return this.storeSettings.priceLabel(product);
  }
  inventoryValueLabel(): string {
    return this.storeSettings.formatMoney(this.inventoryValue());
  }
  async saveStoreSettings(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.auth.user()) return;
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const settings: StoreSettings = {
      whatsappNumber: String(data.get('whatsappNumber') || '').trim(),
      instagramUrl: String(data.get('instagramUrl') || '').trim(),
      contactEmail: String(data.get('contactEmail') || '').trim(),
      businessAddress: String(data.get('businessAddress') || '').trim(),
      deliveryInformation: String(data.get('deliveryInformation') || '').trim(),
      currency: String(data.get('currency') || 'EUR'),
      defaultLanguage: String(
        data.get('defaultLanguage') || 'en',
      ) as StoreSettings['defaultLanguage'],
      announcementText: String(data.get('announcementText') || '').trim(),
      updatedAt: Date.now(),
    };
    this.savingSettings.set(true);
    this.settingsMessage.set('');
    try {
      await this.storeSettings.save(settings);
      this.settingsMessage.set('Store settings saved successfully.');
      this.notify('Store settings saved successfully.');
    } catch (error) {
      this.settingsMessage.set(
        error instanceof Error
          ? error.message
          : 'Store settings could not be saved.',
      );
    } finally {
      this.savingSettings.set(false);
    }
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
    this.removedImages.set([]);
    this.uploadedThisSession.set([]);
    this.productEditorDirty.set(false);
    this.formError.set('');
    this.productStore.clearStockHistory();
    this.productEditorOpen.set(true);
  }
  editProduct(product: Product): void {
    if (!this.auth.user()) return;
    this.editingProductId.set(product.id);
    this.pendingImages.set([...(product.images ?? [])]);
    this.removedImages.set([]);
    this.uploadedThisSession.set([]);
    this.productEditorDirty.set(false);
    this.formError.set('');
    void this.productStore.loadStockHistory(product.id);
    this.productEditorOpen.set(true);
    setTimeout(() => this.fillProductForm(product));
  }
  duplicateProduct(product: Product): void {
    if (!this.auth.user()) return;
    this.editingProductId.set(null);
    this.pendingImages.set([...(product.images ?? [])]);
    this.removedImages.set([]);
    this.uploadedThisSession.set([]);
    this.productEditorDirty.set(false);
    this.formError.set('');
    this.productStore.clearStockHistory();
    this.productEditorOpen.set(true);
    setTimeout(() =>
      this.fillProductForm({
        ...product,
        name: `${product.name} copy`,
        sku: '',
      }),
    );
  }
  duplicateEditingProduct(): void {
    const product = this.editingProductId()
      ? this.productStore.find(this.editingProductId()!)
      : undefined;
    if (product) this.duplicateProduct(product);
  }
  closeProductEditor(force = false): void {
    if (
      !force &&
      this.productEditorDirty() &&
      typeof window !== 'undefined' &&
      !window.confirm('Discard unsaved product changes?')
    )
      return;
    if (!force && this.uploadedThisSession().length) {
      void this.cloudinary
        .deleteImages(this.uploadedThisSession())
        .catch((error) =>
          this.notify(
            error instanceof Error
              ? error.message
              : 'Unused images could not be deleted.',
            true,
          ),
        );
    }
    this.productEditorOpen.set(false);
    this.formError.set('');
    this.productStore.clearStockHistory();
    this.productEditorDirty.set(false);
    this.removedImages.set([]);
    this.uploadedThisSession.set([]);
  }
  markProductDirty(): void {
    this.productEditorDirty.set(true);
  }
  @HostListener('window:beforeunload', ['$event'])
  protectUnsavedChanges(event: BeforeUnloadEvent): void {
    if (this.productEditorOpen() && this.productEditorDirty())
      event.preventDefault();
  }
  private notify(message: string, error = false): void {
    this.adminNotice.set(message);
    this.adminNoticeError.set(error);
    if (typeof window !== 'undefined')
      window.setTimeout(() => {
        if (this.adminNotice() === message) this.adminNotice.set('');
      }, 5000);
  }
  isLowStock(product: Product): boolean {
    const stock = totalStock(product);
    return stock > 0 && stock <= (product.lowStockThreshold ?? 3);
  }
  async adjustStock(
    product: Product,
    delta: number,
    reason: StockMovementReason,
  ): Promise<void> {
    if (!this.auth.user() || this.stockActionId()) return;
    if (totalStock(product) + delta < 0) return;
    this.stockActionId.set(product.id);
    this.inventoryError.set('');
    try {
      await this.productStore.adjustStock(product.id, delta, reason);
      this.notify(`Stock for “${product.name}” updated.`);
    } catch (error) {
      this.inventoryError.set(
        error instanceof Error ? error.message : 'Stock could not be updated.',
      );
    } finally {
      this.stockActionId.set(null);
    }
  }
  async restockProduct(product: Product): Promise<void> {
    if (typeof window === 'undefined') return;
    const raw = window.prompt(
      `How many units were added to ${product.name}?`,
      '1',
    );
    if (raw === null) return;
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100000) {
      this.inventoryError.set(
        'Restock quantity must be a whole number between 1 and 100,000.',
      );
      return;
    }
    await this.adjustStock(product, quantity, 'restock');
  }
  movementLabel(movement: StockMovement): string {
    return movement.reason === 'restock'
      ? 'Restocked'
      : movement.delta > 0
        ? 'Added'
        : 'Removed';
  }
  movementDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  }
  async updateRequestStatus(
    request: CustomerRequest,
    status: CustomerRequestStatus,
  ): Promise<void> {
    if (!this.auth.user() || this.requestActionId()) return;
    this.requestActionId.set(request.id);
    this.requestError.set('');
    try {
      await this.requestStore.setStatus(request, status);
      this.notify(`Request ${request.reference} marked ${status}.`);
    } catch (error) {
      this.requestError.set(
        error instanceof Error
          ? error.message
          : 'Request status could not be updated.',
      );
    } finally {
      this.requestActionId.set(null);
    }
  }
  requestDate(timestamp: number): string {
    return this.movementDate(timestamp);
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
      this.uploadedThisSession.update((current) => [...current, ...images]);
      this.productEditorDirty.set(true);
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
    const image = this.pendingImages()[index];
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Remove this image? It will be deleted from Cloudinary after the product is saved.',
      )
    )
      return;
    if (image?.publicId)
      this.removedImages.update((images) => [...images, image]);
    this.pendingImages.update((images) => images.filter((_, i) => i !== index));
    this.productEditorDirty.set(true);
  }
  moveImage(index: number, direction: -1 | 1): void {
    this.pendingImages.update((images) => {
      const target = index + direction;
      if (target < 0 || target >= images.length) return images;
      const result = [...images];
      [result[index], result[target]] = [result[target], result[index]];
      this.productEditorDirty.set(true);
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
    const originalPrice = Number(data.get('originalPrice'));
    const wigDetails = {
      length: String(data.get('wigLength') || '').trim(),
      texture: String(data.get('wigTexture') || '').trim(),
      laceType: String(data.get('wigLaceType') || '').trim(),
      density: String(data.get('wigDensity') || '').trim(),
    };
    const product: Product = {
      id: existing?.id ?? `product-${Date.now()}`,
      name: String(data.get('name') || '').trim(),
      sku: String(data.get('sku') || '')
        .trim()
        .toUpperCase(),
      category: String(data.get('category') || ''),
      price: Number(data.get('price')),
      ...(originalPrice > 0 ? { originalPrice } : {}),
      priceMode: String(data.get('priceMode') || 'fixed') as PriceMode,
      negotiable: data.get('negotiable') === 'on',
      stock: existing
        ? totalStock(existing)
        : Math.max(0, Number(data.get('stock')) || 0),
      lowStockThreshold: Math.max(
        0,
        Number(data.get('lowStockThreshold')) || 0,
      ),
      art: String(data.get('art') || 'dress'),
      description: String(data.get('description') || '').trim(),
      images: this.pendingImages(),
      colors: this.parseColors(String(data.get('colors') || '')),
      sizes: this.parseList(String(data.get('sizes') || '')),
      audiences: this.parseList(String(data.get('audiences') || '')),
      ageRange: String(data.get('ageRange') || '').trim(),
      tags: this.parseList(String(data.get('tags') || '')),
      featured: data.get('featured') === 'on',
      newArrival: data.get('newArrival') === 'on',
      limitedQuantity: data.get('limitedQuantity') === 'on',
      relatedProductIds: data.getAll('relatedProductIds').map(String),
      ...(Object.values(wigDetails).some(Boolean) ? { wigDetails } : {}),
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
    if (
      this.products().some(
        (item) =>
          item.id !== product.id &&
          item.sku?.toLowerCase() === product.sku?.toLowerCase(),
      )
    ) {
      this.formError.set(
        'SKU must be unique. Another product already uses this reference.',
      );
      return;
    }
    this.savingProduct.set(true);
    this.formError.set('');
    try {
      await this.productStore.save(product);
      await this.cloudinary.deleteImages(this.removedImages());
      this.productEditorDirty.set(false);
      this.uploadedThisSession.set([]);
      this.notify(`Product “${product.name}” saved successfully.`);
      this.closeProductEditor(true);
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
    const product = this.productStore.find(this.editingProductId()!);
    try {
      await this.productStore.remove(this.editingProductId()!);
      let cleanupWarning = '';
      try {
        if (product) await this.cloudinary.deleteImages(product.images);
      } catch (error) {
        cleanupWarning =
          error instanceof Error ? error.message : 'Cloudinary cleanup failed.';
      }
      this.productEditorDirty.set(false);
      this.notify(
        cleanupWarning
          ? `Product deleted, but ${cleanupWarning}`
          : `Product “${product?.name ?? 'Product'}” deleted.`,
        Boolean(cleanupWarning),
      );
      this.closeProductEditor(true);
    } catch (error) {
      this.formError.set(
        error instanceof Error
          ? error.message
          : 'Product could not be deleted.',
      );
    }
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
    const existing = this.editingCategoryId()
      ? this.categoryStore.find(this.editingCategoryId()!)
      : undefined;
    const id =
      existing?.id ?? (parentCategoryId ? `${parentCategoryId}-${slug}` : slug);
    const category: Category = {
      id,
      name,
      slug,
      description: String(data.get('description') || '').trim(),
      parentCategoryId,
      active: existing?.active ?? true,
      displayOrder:
        existing?.displayOrder ?? this.categoryStore.categories().length + 1,
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
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
      this.editingCategoryId.set(null);
      this.categoryError.set('');
      this.notify(`Category “${category.name}” saved successfully.`);
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Could not save this category.',
      );
    }
  }
  editCategory(category: Category): void {
    if (!this.auth.user()) return;
    this.editingCategoryId.set(category.id);
    this.categoryError.set('');
    setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>(
        '.dashboard-category-form',
      );
      if (!form) return;
      (form.elements.namedItem('name') as HTMLInputElement).value =
        category.name;
      (form.elements.namedItem('parentCategoryId') as HTMLSelectElement).value =
        category.parentCategoryId ?? '';
      (form.elements.namedItem('description') as HTMLInputElement).value =
        category.description;
      form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });
  }
  cancelCategoryEdit(): void {
    this.editingCategoryId.set(null);
    this.categoryError.set('');
    document
      .querySelector<HTMLFormElement>('.dashboard-category-form')
      ?.reset();
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
      this.notify('Starter categories imported successfully.');
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
    if (!this.auth.user()) return;
    try {
      await this.categoryStore.save({ ...category, active });
      this.notify(
        `Category “${category.name}” ${active ? 'shown' : 'hidden'}.`,
      );
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Category visibility could not be changed.',
      );
    }
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
    try {
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
      this.notify(`Category “${category.name}” reordered.`);
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Categories could not be reordered.',
      );
    }
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
    try {
      await this.categoryStore.remove(category.id);
      this.categoryError.set('');
      this.notify(`Category “${category.name}” deleted.`);
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Category could not be deleted.',
      );
    }
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
    (form.elements.namedItem('sku') as HTMLInputElement).value =
      product.sku ?? '';
    (form.elements.namedItem('category') as HTMLSelectElement).value =
      product.category;
    (form.elements.namedItem('price') as HTMLInputElement).value = String(
      product.price,
    );
    (form.elements.namedItem('originalPrice') as HTMLInputElement).value =
      product.originalPrice ? String(product.originalPrice) : '';
    (form.elements.namedItem('priceMode') as HTMLSelectElement).value =
      product.priceMode ?? 'fixed';
    (form.elements.namedItem('negotiable') as HTMLInputElement).checked =
      Boolean(product.negotiable);
    (form.elements.namedItem('stock') as HTMLInputElement).value = String(
      totalStock(product),
    );
    (form.elements.namedItem('lowStockThreshold') as HTMLInputElement).value =
      String(product.lowStockThreshold ?? 3);
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
    (form.elements.namedItem('newArrival') as HTMLInputElement).checked =
      Boolean(product.newArrival);
    (form.elements.namedItem('limitedQuantity') as HTMLInputElement).checked =
      Boolean(product.limitedQuantity);
    (form.elements.namedItem('wigLength') as HTMLInputElement).value =
      product.wigDetails?.length ?? '';
    (form.elements.namedItem('wigTexture') as HTMLInputElement).value =
      product.wigDetails?.texture ?? '';
    (form.elements.namedItem('wigLaceType') as HTMLInputElement).value =
      product.wigDetails?.laceType ?? '';
    (form.elements.namedItem('wigDensity') as HTMLInputElement).value =
      product.wigDetails?.density ?? '';
    const related = new Set(product.relatedProductIds ?? []);
    form
      .querySelectorAll<HTMLInputElement>('input[name="relatedProductIds"]')
      .forEach((input) => {
        input.checked = related.has(input.value);
      });
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
