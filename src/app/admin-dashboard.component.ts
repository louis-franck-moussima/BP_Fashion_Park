import {
  Component,
  OnInit,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { CategoryStore } from './category-store.service';
import { ProductStore } from './product-store.service';
import {
  PriceMode,
  Product,
  ProductPublicationStatus,
  ProductImage,
  ProductPurchasingInfo,
  StockMovement,
  StockMovementReason,
  totalStock,
  productStatus,
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
import { AdminSubcategoryManagerComponent } from './admin-subcategory-manager.component';
import {
  InventoryCsvPreview,
  InventoryCsvService,
} from './inventory-csv.service';
import { AdminActivityService } from './admin-activity.service';
import { AdminActivityType, NewAdminActivity } from './admin-activity.model';

type AdminSection =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'categories'
  | 'subcategories'
  | 'requests'
  | 'activity'
  | 'settings';

type InventoryFilter =
  | 'all'
  | 'restock'
  | 'low'
  | 'out'
  | 'draft'
  | 'hidden'
  | 'archived'
  | 'incomplete';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, AdminSubcategoryManagerComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: [
    './admin-dashboard.component.css',
    './admin-dashboard-editor.component.css',
    './admin-category-form.component.css',
    './admin-category-visibility.component.css',
    './admin-sidebar-nav.component.css',
    './admin-search.component.css',
    './admin-inventory.component.css',
    './admin-inventory-csv.component.css',
    './admin-request-followup.component.css',
    './admin-request-layout.component.css',
    './admin-dashboard-actions.component.css',
    './admin-purchasing.component.css',
    './admin-activity.component.css',
  ],
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AdminAuthService);
  readonly productStore = inject(ProductStore);
  readonly categoryStore = inject(CategoryStore);
  readonly requestStore = inject(CustomerRequestStore);
  readonly storeSettings = inject(StoreSettingsService);
  readonly activity = inject(AdminActivityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly inventoryCsv = inject(InventoryCsvService);
  readonly section = signal<AdminSection>('overview');
  readonly sectionTitle = computed(
    () =>
      ({
        overview: 'Dashboard',
        products: 'Products',
        inventory: 'Inventory',
        categories: 'Categories',
        subcategories: 'Subcategories',
        requests: 'Customer requests',
        activity: 'Activity history',
        settings: 'Store settings',
      })[this.section()],
  );
  readonly newRequestCount = computed(
    () =>
      this.requestStore.requests().filter((request) => request.status === 'new')
        .length,
  );
  readonly products = this.productStore.products;
  readonly adminSearch = signal('');
  readonly searchPanelOpen = signal(false);
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
  readonly inventoryFilter = signal<InventoryFilter>('all');
  readonly csvPreview = signal<InventoryCsvPreview | null>(null);
  readonly csvReading = signal(false);
  readonly csvApplying = signal(false);
  readonly requestActionId = signal<string | null>(null);
  readonly requestError = signal('');
  readonly requestSearch = signal('');
  readonly requestStatusFilter = signal<'all' | CustomerRequestStatus>('all');
  readonly expandedRequestId = signal<string | null>(null);
  readonly followUpSavingId = signal<string | null>(null);
  readonly filteredRequests = computed(() => {
    const query = this.requestSearch().trim().toLowerCase();
    const status = this.requestStatusFilter();
    return this.requestStore.requests().filter((request) => {
      if (status !== 'all' && request.status !== status) return false;
      if (!query) return true;
      return `${request.reference} ${request.name} ${request.phone} ${request.city} ${request.message} ${request.ownerNotes ?? ''}`
        .toLowerCase()
        .includes(query);
    });
  });
  readonly categoryError = signal('');
  readonly pendingCategoryImage = signal<ProductImage | null>(null);
  readonly categoryImageToDelete = signal<ProductImage | null>(null);
  readonly categoryUploadedThisSession = signal<ProductImage | null>(null);
  readonly categoryImageUploading = signal(false);
  readonly editingCategoryId = signal<string | null>(null);
  readonly categoryKind = signal<'category' | 'subcategory'>('category');
  readonly importingStarterCategories = signal(false);
  readonly allCategories = computed(() =>
    [...this.categoryStore.categories()].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    ),
  );
  readonly mainCategories = computed(() =>
    this.allCategories().filter((category) => !category.parentCategoryId),
  );
  readonly searchedProducts = computed(() => {
    const query = this.adminSearch().trim().toLowerCase();
    if (!query) return this.products();
    return this.products().filter((product) => {
      const stock = totalStock(product);
      const stockLabel = stock === 0
        ? 'out of stock unavailable sold out'
        : this.isLowStock(product)
          ? 'low stock limited available'
          : 'in stock available';
      return [
        product.name, product.sku, product.description,
        ...Object.values(this.productStore.purchasingInfo()[product.id] ?? {}),
        this.categoryStore.pathLabel(product.category),
        ...product.colors.map((color) => `${color.name} ${color.hex}`),
        ...(product.sizes ?? []), ...(product.tags ?? []),
        ...(product.audiences ?? []), product.ageRange,
        stockLabel, productStatus(product), String(stock),
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  });
  readonly searchedCategories = computed(() => {
    const query = this.adminSearch().trim().toLowerCase();
    const categories = this.categoryStore.categories();
    if (!query) return categories;
    return categories.filter((category) =>
      `${category.name} ${category.description} ${this.categoryStore.pathLabel(category.id)} ${category.active ? 'active visible' : 'inactive hidden'}`
        .toLowerCase().includes(query),
    );
  });
  readonly searchedMainCategories = computed(() =>
    this.searchedCategories().filter((category) => !category.parentCategoryId),
  );
  readonly inventoryProducts = computed(() =>
    this.searchedProducts().filter((product) => {
      const filter = this.inventoryFilter();
      if (filter === 'restock')
        return totalStock(product) === 0 || this.isLowStock(product);
      if (filter === 'low') return this.isLowStock(product);
      if (filter === 'out') return totalStock(product) === 0;
      if (filter === 'incomplete')
        return !product.sku || !product.images.length || product.description.length < 20;
      if (['draft', 'hidden', 'archived'].includes(filter))
        return productStatus(product) === filter;
      return true;
    }),
  );
  readonly incompleteProductCount = computed(() =>
    this.products().filter(
      (product) => !product.sku || !product.images.length || product.description.length < 20,
    ).length,
  );
  readonly restockProductCount = computed(() =>
    this.products().filter(
      (product) => totalStock(product) === 0 || this.isLowStock(product),
    ).length,
  );
  readonly hiddenProductCount = computed(() =>
    this.products().filter((product) => productStatus(product) === 'hidden').length,
  );
  readonly subcategoryCount = computed(
    () =>
      this.categoryStore.categories().filter((category) => category.parentCategoryId)
        .length,
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
    this.route.queryParamMap.subscribe((params) => {
      const requested = params.get('section') as AdminSection | null;
      if (
        requested &&
        ['overview', 'products', 'inventory', 'categories', 'subcategories', 'requests', 'activity', 'settings'].includes(requested)
      )
        this.section.set(requested);
    });
  }

  selectSection(section: AdminSection): void {
    this.section.set(section);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: section === 'overview' ? {} : { section },
      replaceUrl: true,
    });
  }

  openInventoryFilter(filter: InventoryFilter): void {
    this.inventoryFilter.set(filter);
    this.adminSearch.set('');
    this.selectSection('inventory');
  }

  openNewRequests(): void {
    this.requestStatusFilter.set('new');
    this.selectSection('requests');
  }

  stockProductName(productId: string): string {
    return this.productStore.find(productId)?.name ?? 'Deleted product';
  }

  openStockMovement(movement: StockMovement): void {
    const product = this.productStore.find(movement.productId);
    this.inventoryFilter.set('all');
    this.adminSearch.set(product?.sku || product?.name || '');
    this.selectSection('inventory');
  }

  openProductResult(product: Product): void {
    this.searchPanelOpen.set(false);
    this.selectSection('products');
    if (typeof document !== 'undefined')
      setTimeout(() =>
        document.getElementById(`admin-product-${product.id}`)?.scrollIntoView({
          behavior: 'smooth', block: 'center',
        }),
      );
  }

  openCategoryResult(category: Category): void {
    this.searchPanelOpen.set(false);
    this.selectSection(category.parentCategoryId ? 'subcategories' : 'categories');
  }

  clearAdminSearch(): void {
    this.adminSearch.set('');
    this.searchPanelOpen.set(false);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.productStore.initialize(),
      this.categoryStore.initialize(),
      this.storeSettings.initialize(),
    ]);
    await Promise.all([
      this.productStore.loadRecentStockHistory(),
      this.productStore.loadPurchasingInfo(),
      this.activity.initialize(),
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
        status: 'draft',
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
  private recordActivity(entry: NewAdminActivity): void {
    void this.activity.record(entry).catch(() =>
      this.notify(
        'The change was saved, but its activity entry could not be recorded.',
        true,
      ),
    );
  }
  isLowStock(product: Product): boolean {
    const stock = totalStock(product);
    return stock > 0 && stock <= (product.lowStockThreshold ?? 3);
  }
  publicationStatus(product: Product): ProductPublicationStatus {
    return productStatus(product);
  }
  publicationCount(status: ProductPublicationStatus): number {
    return this.products().filter((product) => productStatus(product) === status).length;
  }
  async setProductStatus(
    product: Product,
    status: ProductPublicationStatus,
  ): Promise<void> {
    if (!this.auth.isOwner()) return;
    this.inventoryError.set('');
    try {
      const previousStatus = productStatus(product);
      await this.productStore.save({ ...product, status });
      this.recordActivity({
        type: 'product_status_changed', entityType: 'product', entityId: product.id,
        title: `${product.name} marked ${status}`,
        description: `Publication status changed from ${previousStatus} to ${status}.`,
      });
      this.notify(`“${product.name}” is now ${status}.`);
    } catch (error) {
      this.inventoryError.set(
        error instanceof Error ? error.message : 'Product status could not be updated.',
      );
    }
  }
  exportInventoryCsv(): void {
    if (typeof document === 'undefined') return;
    this.inventoryCsv.export(this.products(), (id) =>
      this.categoryStore.pathLabel(id),
    );
    this.notify('Inventory CSV exported.');
  }
  async previewInventoryCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.csvReading.set(true);
    this.inventoryError.set('');
    try {
      this.csvPreview.set(await this.inventoryCsv.parse(file, this.products()));
    } catch (error) {
      this.csvPreview.set(null);
      this.inventoryError.set(
        error instanceof Error ? error.message : 'The CSV file could not be read.',
      );
    } finally {
      this.csvReading.set(false);
      input.value = '';
    }
  }
  async applyInventoryCsv(): Promise<void> {
    const preview = this.csvPreview();
    if (!preview || preview.errors.length || !preview.changes.length || !this.auth.isOwner())
      return;
    this.csvApplying.set(true);
    this.inventoryError.set('');
    let completed = 0;
    try {
      for (const change of preview.changes) {
        await this.productStore.applyInventoryChange(
          change.product.id,
          change.stock,
          change.status,
          change.lowStockThreshold,
          change.price,
        );
        completed++;
      }
      this.csvPreview.set(null);
      this.notify(`${completed} inventory ${completed === 1 ? 'item' : 'items'} updated from CSV.`);
    } catch (error) {
      this.inventoryError.set(
        `${completed} rows were applied before the import stopped. ${error instanceof Error ? error.message : 'Import failed.'}`,
      );
    } finally {
      this.csvApplying.set(false);
    }
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
      this.recordActivity({
        type: 'stock_adjusted', entityType: 'product', entityId: product.id,
        title: `Stock changed for ${product.name}`,
        description: `${delta > 0 ? '+' : ''}${delta} units · ${totalStock(product)} to ${totalStock(product) + delta}.`,
      });
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
  activityTypeLabel(type: AdminActivityType): string {
    return ({
      product_created: 'Product created',
      product_edited: 'Product edited',
      stock_adjusted: 'Stock adjusted',
      product_status_changed: 'Publication changed',
      category_changed: 'Category changed',
      request_status_changed: 'Request updated',
    })[type];
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
      this.recordActivity({
        type: 'request_status_changed', entityType: 'request', entityId: request.id,
        title: `${request.reference} marked ${status}`,
        description: `Customer request status changed from ${request.status} to ${status}.`,
      });
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
  requestStatusCount(status: 'all' | CustomerRequestStatus): number {
    return status === 'all'
      ? this.requestStore.requests().length
      : this.requestStore.requests().filter((request) => request.status === status).length;
  }
  toggleRequestDetails(request: CustomerRequest): void {
    this.expandedRequestId.set(
      this.expandedRequestId() === request.id ? null : request.id,
    );
  }
  customerWhatsappUrl(request: CustomerRequest): string {
    const phone = request.phone.replace(/\D/g, '');
    const message = `Hello ${request.name}, this is BP Fashion Park regarding your request ${request.reference}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }
  customerHistory(request: CustomerRequest): CustomerRequest[] {
    const phone = request.phone.replace(/\D/g, '');
    return this.requestStore
      .requests()
      .filter(
        (item) => item.id !== request.id && item.phone.replace(/\D/g, '') === phone,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  openPreviousRequest(request: CustomerRequest): void {
    this.requestStatusFilter.set('all');
    this.requestSearch.set(request.reference);
    this.expandedRequestId.set(request.id);
  }
  followUpInputValue(request: CustomerRequest): string {
    if (!request.followUpAt) return '';
    const date = new Date(request.followUpAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  followUpLabel(timestamp: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  }
  isFollowUpDue(request: CustomerRequest): boolean {
    return Boolean(
      request.followUpAt &&
        request.followUpAt <= Date.now() &&
        !['confirmed', 'closed'].includes(request.status),
    );
  }
  async saveRequestFollowUp(request: CustomerRequest, event: Event): Promise<void> {
    event.preventDefault();
    if (this.followUpSavingId()) return;
    const data = new FormData(event.target as HTMLFormElement);
    const rawDate = String(data.get('followUpAt') || '');
    const followUpAt = rawDate ? new Date(rawDate).getTime() : null;
    this.followUpSavingId.set(request.id);
    this.requestError.set('');
    try {
      await this.requestStore.saveFollowUp(
        request,
        String(data.get('ownerNotes') || ''),
        followUpAt,
      );
      this.notify(`Follow-up details saved for ${request.reference}.`);
    } catch (error) {
      this.requestError.set(
        error instanceof Error ? error.message : 'Follow-up details could not be saved.',
      );
    } finally {
      this.followUpSavingId.set(null);
    }
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
    const purchaseCost = Number(data.get('purchaseCost'));
    const purchasingInfo: ProductPurchasingInfo = {
      productId: existing?.id ?? `product-${Date.now()}`,
      supplierName: String(data.get('supplierName') || '').trim(),
      supplierContact: String(data.get('supplierContact') || '').trim(),
      supplierReference: String(data.get('supplierReference') || '').trim(),
      ...(purchaseCost > 0 ? { purchaseCost } : {}),
      purchaseDate: String(data.get('purchaseDate') || ''),
      batchReference: String(data.get('batchReference') || '').trim(),
      notes: String(data.get('purchasingNotes') || '').trim(),
      updatedAt: Date.now(),
    };
    const product: Product = {
      id: purchasingInfo.productId,
      status: String(data.get('status') || 'draft') as ProductPublicationStatus,
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
      await this.productStore.savePurchasingInfo(purchasingInfo);
      this.recordActivity({
        type: existing ? 'product_edited' : 'product_created',
        entityType: 'product', entityId: product.id,
        title: `${existing ? 'Edited' : 'Created'} ${product.name}`,
        description: `${product.sku} · ${this.categoryStore.pathLabel(product.category)}.`,
      });
      if (existing && productStatus(existing) !== productStatus(product))
        this.recordActivity({
          type: 'product_status_changed', entityType: 'product', entityId: product.id,
          title: `${product.name} marked ${productStatus(product)}`,
          description: `Publication status changed from ${productStatus(existing)} to ${productStatus(product)}.`,
        });
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
    const parentCategoryId =
      this.categoryKind() === 'subcategory'
        ? String(data.get('parentCategoryId') || '') || null
        : null;
    if (this.categoryKind() === 'subcategory' && !parentCategoryId) {
      this.categoryError.set('Choose the parent for this subcategory.');
      return;
    }
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
      ...(this.pendingCategoryImage()
        ? {
            imageUrl: this.pendingCategoryImage()!.url,
            ...(this.pendingCategoryImage()!.publicId
              ? { imagePublicId: this.pendingCategoryImage()!.publicId }
              : {}),
            imagePosition: String(
              data.get('imagePosition') || 'center',
            ) as Category['imagePosition'],
          }
        : {}),
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
      this.recordActivity({
        type: 'category_changed', entityType: 'category', entityId: category.id,
        title: `${existing ? 'Edited' : 'Created'} ${category.name}`,
        description: `${category.parentCategoryId ? 'Subcategory' : 'Category'} saved in ${this.categoryStore.pathLabel(category.id)}.`,
      });
      if (this.categoryImageToDelete())
        await this.cloudinary.deleteImages([this.categoryImageToDelete()!]);
      form.reset();
      this.categoryKind.set('category');
      this.editingCategoryId.set(null);
      this.pendingCategoryImage.set(null);
      this.categoryImageToDelete.set(null);
      this.categoryUploadedThisSession.set(null);
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
    this.categoryKind.set(
      category.parentCategoryId ? 'subcategory' : 'category',
    );
    this.categoryError.set('');
    this.pendingCategoryImage.set(
      category.imageUrl
        ? {
            url: category.imageUrl,
            publicId: category.imagePublicId,
            alt: `${category.name} category cover`,
          }
        : null,
    );
    this.categoryImageToDelete.set(null);
    this.categoryUploadedThisSession.set(null);
    setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>(
        '.dashboard-category-form',
      );
      if (!form) return;
      (form.elements.namedItem('name') as HTMLInputElement).value =
        category.name;
      const parent = form.elements.namedItem(
        'parentCategoryId',
      ) as HTMLSelectElement | null;
      if (parent) parent.value = category.parentCategoryId ?? '';
      (form.elements.namedItem('description') as HTMLInputElement).value =
        category.description;
      (form.elements.namedItem('imagePosition') as HTMLSelectElement).value =
        category.imagePosition ?? 'center';
      form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });
  }
  cancelCategoryEdit(): void {
    if (this.categoryUploadedThisSession())
      void this.cloudinary
        .deleteImages([this.categoryUploadedThisSession()!])
        .catch((error) =>
          this.notify(
            error instanceof Error
              ? error.message
              : 'Unused category image could not be deleted.',
            true,
          ),
        );
    this.editingCategoryId.set(null);
    this.categoryKind.set('category');
    this.categoryError.set('');
    this.pendingCategoryImage.set(null);
    this.categoryImageToDelete.set(null);
    this.categoryUploadedThisSession.set(null);
    document
      .querySelector<HTMLFormElement>('.dashboard-category-form')
      ?.reset();
  }
  async selectCategoryImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.categoryImageUploading.set(true);
    this.categoryError.set('');
    try {
      const form = document.querySelector<HTMLFormElement>(
        '.dashboard-category-form',
      );
      const name =
        (form?.elements.namedItem('name') as HTMLInputElement | null)?.value ||
        'Category';
      const current = this.pendingCategoryImage();
      const uploaded = await this.cloudinary.uploadCategory(file, name);
      if (
        current?.publicId &&
        current.publicId !== this.categoryUploadedThisSession()?.publicId
      )
        this.categoryImageToDelete.set(current);
      if (this.categoryUploadedThisSession()?.publicId)
        await this.cloudinary.deleteImages([
          this.categoryUploadedThisSession()!,
        ]);
      this.pendingCategoryImage.set(uploaded);
      this.categoryUploadedThisSession.set(uploaded);
    } catch (error) {
      this.categoryError.set(
        error instanceof Error
          ? error.message
          : 'Category image upload failed.',
      );
    } finally {
      this.categoryImageUploading.set(false);
      input.value = '';
    }
  }
  removeCategoryImage(): void {
    const current = this.pendingCategoryImage();
    if (
      !current ||
      (typeof window !== 'undefined' &&
        !window.confirm('Remove this category cover image?'))
    )
      return;
    this.categoryImageToDelete.set(current);
    this.pendingCategoryImage.set(null);
  }
  async toggleCategory(category: Category): Promise<void> {
    if (this.auth.user()) {
      await this.categoryStore.save({ ...category, active: !category.active });
      this.recordActivity({
        type: 'category_changed', entityType: 'category', entityId: category.id,
        title: `${category.name} ${category.active ? 'hidden' : 'shown'}`,
        description: 'Category storefront visibility changed.',
      });
    }
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
      this.recordActivity({
        type: 'category_changed', entityType: 'category', entityId: category.id,
        title: `${category.name} ${active ? 'shown' : 'hidden'}`,
        description: 'Category storefront visibility changed.',
      });
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
      this.recordActivity({
        type: 'category_changed', entityType: 'category', entityId: category.id,
        title: `Reordered ${category.name}`,
        description: `Category moved ${direction < 0 ? 'up' : 'down'} in its branch.`,
      });
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
      const categoryImages = [
        category,
        ...this.categoryStore.descendants(category.id),
      ]
        .filter((item) => item.imageUrl)
        .map((item) => ({
          url: item.imageUrl!,
          publicId: item.imagePublicId,
          alt: `${item.name} category cover`,
        }));
      await this.categoryStore.remove(category.id);
      this.categoryError.set('');
      let cleanupWarning = '';
      try {
        await this.cloudinary.deleteImages(categoryImages);
      } catch (error) {
        cleanupWarning =
          error instanceof Error ? error.message : 'Cloudinary cleanup failed.';
      }
      this.notify(
        cleanupWarning
          ? `Category deleted, but ${cleanupWarning}`
          : `Category “${category.name}” deleted.`,
        Boolean(cleanupWarning),
      );
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
    (form.elements.namedItem('status') as HTMLSelectElement).value =
      productStatus(product);
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
    const purchasing = this.productStore.purchasingInfo()[product.id];
    (form.elements.namedItem('supplierName') as HTMLInputElement).value =
      purchasing?.supplierName ?? '';
    (form.elements.namedItem('supplierContact') as HTMLInputElement).value =
      purchasing?.supplierContact ?? '';
    (form.elements.namedItem('supplierReference') as HTMLInputElement).value =
      purchasing?.supplierReference ?? '';
    (form.elements.namedItem('purchaseCost') as HTMLInputElement).value =
      purchasing?.purchaseCost ? String(purchasing.purchaseCost) : '';
    (form.elements.namedItem('purchaseDate') as HTMLInputElement).value =
      purchasing?.purchaseDate ?? '';
    (form.elements.namedItem('batchReference') as HTMLInputElement).value =
      purchasing?.batchReference ?? '';
    (form.elements.namedItem('purchasingNotes') as HTMLTextAreaElement).value =
      purchasing?.notes ?? '';
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
