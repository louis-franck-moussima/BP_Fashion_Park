import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  Product,
  ProductCategory,
  ProductImage,
  totalStock,
} from './product.model';
import { CloudinaryService } from './cloudinary.service';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ProductStore } from './product-store.service';
import { AdminAuthService } from './admin-auth.service';
import { CategoryStore } from './category-store.service';
import { Category } from './category.model';
import { CartService } from './cart.service';
import { SeoService } from './seo.service';
import { CustomerRequestStore } from './customer-request-store.service';
import { CustomerRequest } from './customer-request.model';
import { StoreSettingsService } from './store-settings.service';
import type { CountryCode } from 'libphonenumber-js';
import type { PhoneCountryOption } from './phone-countries';

type CategoryFilter = 'All' | ProductCategory;
type SortOption = 'featured' | 'price-low' | 'price-high' | 'newest';
type Language = 'en' | 'fr';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './app-catalog-nav.css', './app-category-photography.css'],
})
export class App implements OnInit, OnDestroy {
  private heroTimer?: ReturnType<typeof setInterval>;
  private readonly store = inject(ProductStore);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly router = inject(Router);
  readonly auth = inject(AdminAuthService);
  readonly categoryStore = inject(CategoryStore);
  readonly cart = inject(CartService);
  readonly customerRequests = inject(CustomerRequestStore);
  readonly storeSettings = inject(StoreSettingsService);
  private readonly seo = inject(SeoService);
  readonly menuOpen = signal(false);
  readonly mobileMenuPath = signal<string[]>([]);
  readonly megaMenuDismissed = signal(false);
  readonly searchOpen = signal(false);
  readonly language = signal<Language>('en');
  readonly activeCategory = signal<CategoryFilter>('All');
  readonly searchQuery = signal('');
  readonly sortBy = signal<SortOption>('newest');
  readonly inStockOnly = signal(false);
  readonly email = signal('');
  readonly subscribed = signal(false);
  readonly adminOpen = signal(false);
  readonly categoryAdminOpen = signal(false);
  readonly categoryError = signal('');
  readonly requestSubmitting = signal(false);
  readonly requestError = signal('');
  readonly requestPdfBusy = signal(false);
  readonly requestPdfError = signal('');
  readonly requestPhoneCountry = signal<CountryCode>('CM');
  readonly phoneCountries = signal<PhoneCountryOption[]>([]);
  readonly phoneCountriesLoading = signal(false);
  readonly submittedRequest = signal<CustomerRequest | null>(null);
  readonly requestWhatsappUrl = computed(() => {
    const request = this.submittedRequest();
    return request ? this.cart.whatsappUrlFor(request) : '';
  });
  readonly editingId = signal<string | null>(null);
  readonly pendingImages = signal<ProductImage[]>([]);
  readonly uploadingImages = signal(false);
  readonly uploadError = signal('');
  readonly products = this.store.publicProducts;
  readonly isDetailPage = signal(false);
  readonly isAuthPage = signal(false);
  readonly categories = computed(() => this.categoryStore.active());
  readonly rootCategories = this.categoryStore.roots;
  readonly defaultCategoryImages: Record<string, string> = {
    women: '/categories/women-editorial.jpg',
    men: '/categories/men-editorial.jpg',
    children: '/categories/children-editorial.jpg',
  };
  readonly mobileMenuCurrentCategory = computed(() => {
    const path = this.mobileMenuPath();
    return path.length
      ? this.categoryStore.find(path[path.length - 1])
      : undefined;
  });
  readonly mobileMenuCategories = computed(() => {
    const current = this.mobileMenuCurrentCategory();
    return current
      ? this.categoryStore.children(current.id)
      : this.rootCategories();
  });
  readonly activeRootCategory = computed(() => {
    if (this.activeCategory() === 'All') return null;
    return this.categoryStore.path(this.activeCategory())[0] ?? null;
  });
  readonly visibleSubcategories = computed(() => {
    const root = this.activeRootCategory();
    return root ? this.categoryStore.descendants(root.id) : [];
  });
  readonly isFirebaseLive = this.store.firebaseConfigured;
  readonly catalogLoading = computed(
    () => this.store.loading() || this.categoryStore.loading(),
  );
  readonly catalogError = computed(
    () => this.store.loadError() || this.categoryStore.loadError(),
  );
  readonly isCloudinaryLive = this.cloudinary.configured;
  readonly stockOf = totalStock;
  stockLabel(product: Product): string {
    const stock = totalStock(product);
    if (stock === 0) return 'Out of stock';
    if (stock <= (product.lowStockThreshold ?? 3) || product.limitedQuantity)
      return 'Limited quantity';
    return 'Available';
  }
  readonly whatsappContactUrl = computed(() =>
    this.storeSettings.whatsappUrl('Hello BP Fashion Park'),
  );
  readonly contactEmailUrl = computed(
    () => `mailto:${this.storeSettings.settings().contactEmail}`,
  );
  readonly heroSlide = signal(0);
  readonly heroSlides = [
    {
      image: '/hero-fashion.png',
      eyebrow: 'The new edit · 2026',
      title: 'Style for every',
      accent: 'journey.',
      intro:
        'Thoughtfully selected fashion, accessories and travel essentials for women and men who go their own way.',
      category: 'All' as CategoryFilter,
      position: 'center',
    },
    {
      image: '/hero-tailored-jacket.png',
      eyebrow: 'Modern tailoring · Men',
      title: 'The jacket makes',
      accent: 'the look.',
      intro:
        'Structured layers, relaxed proportions and versatile pieces made for everyday confidence.',
      category: 'men-clothing' as CategoryFilter,
      position: 'center top',
    },
    {
      image: '/hero-camel-coat.png',
      eyebrow: 'New season · Women',
      title: 'Layered in',
      accent: 'confidence.',
      intro:
        'Discover timeless coats and refined essentials designed to carry you beautifully through the season.',
      category: 'women-clothing' as CategoryFilter,
      position: 'center top',
    },
    {
      image: '/hero-family-style.png',
      eyebrow: 'Style for everyone · Family',
      title: 'Together looks',
      accent: 'good.',
      intro:
        'Easy layers, polished essentials and comfortable pieces selected for every member of the family.',
      category: 'All' as CategoryFilter,
      position: 'center top',
    },
  ];

  readonly filteredProducts = computed(() => {
    const category = this.activeCategory();
    const query = this.searchQuery().trim().toLowerCase();
    let result = this.products().filter(
      (product) =>
        this.categoryStore.isVisible(product.category) &&
        (category === 'All' ||
          product.category === category ||
          this.categoryStore
            .descendants(category)
            .some((child) => child.id === product.category)) &&
        (!query ||
          `${product.name} ${this.categoryStore.name(product.category)} ${product.description} ${product.colors.map((c) => c.name).join(' ')} ${(product.sizes ?? []).join(' ')} ${(product.audiences ?? []).join(' ')} ${product.ageRange ?? ''} ${(product.tags ?? []).join(' ')}`
            .toLowerCase()
            .includes(query)) &&
        (!this.inStockOnly() || totalStock(product) > 0),
    );
    switch (this.sortBy()) {
      case 'price-low':
        result = result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result = result.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        result = result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      default:
        result = result.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return result;
  });

  readonly categoryProductSections = computed(() =>
    this.rootCategories()
      .map((category) => {
        const categoryIds = new Set([
          category.id,
          ...this.categoryStore
            .descendants(category.id)
            .map((child) => child.id),
        ]);
        return {
          category,
          products: this.filteredProducts()
            .filter((product) => categoryIds.has(product.category))
            .slice(0, 3),
        };
      })
      .filter((section) => section.products.length),
  );

  categoryShowcaseImage(categoryId: string): string {
    return (
      this.categoryStore.find(categoryId)?.imageUrl ??
      this.defaultCategoryImages[categoryId] ??
      ''
    );
  }

  readonly searchSuggestions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const products = query
      ? this.products().filter(
          (product) =>
            this.categoryStore.isVisible(product.category) &&
            `${product.name} ${this.categoryStore.name(product.category)} ${product.description} ${product.colors.map((color) => color.name).join(' ')} ${(product.sizes ?? []).join(' ')} ${(product.audiences ?? []).join(' ')} ${product.ageRange ?? ''} ${(product.tags ?? []).join(' ')}`
              .toLowerCase()
              .includes(query),
        )
      : this.products().filter(
          (product) =>
            product.featured && this.categoryStore.isVisible(product.category),
        );
    return products.slice(0, 6);
  });

  constructor() {
    effect(() => {
      if (this.submittedRequest() && this.cart.items().length)
        this.submittedRequest.set(null);
    });
    if (typeof window !== 'undefined') {
      const savedLanguage = window.localStorage.getItem('bp-fashion-language');
      if (savedLanguage === 'en' || savedLanguage === 'fr')
        this.language.set(savedLanguage);
    }
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.updateRouteState(url);
        if (typeof window !== 'undefined')
          window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.store.initialize(),
      this.categoryStore.initialize(),
      this.storeSettings.initialize(),
    ]);
    if (
      typeof window !== 'undefined' &&
      !window.localStorage.getItem('bp-fashion-language')
    )
      this.language.set(this.storeSettings.settings().defaultLanguage);
    if (typeof window !== 'undefined') this.startHeroCarousel();
  }

  ngOnDestroy(): void {
    this.stopHeroCarousel();
  }

  showHeroSlide(index: number): void {
    this.heroSlide.set(
      (index + this.heroSlides.length) % this.heroSlides.length,
    );
    this.startHeroCarousel();
  }

  changeHeroSlide(direction: -1 | 1): void {
    this.showHeroSlide(this.heroSlide() + direction);
  }
  pauseHeroCarousel(): void {
    this.stopHeroCarousel();
  }
  resumeHeroCarousel(): void {
    this.startHeroCarousel();
  }

  shopHeroSlide(): void {
    const category = this.heroSlides[this.heroSlide()].category;
    if (category === 'All') {
      this.activeCategory.set('All');
      this.scrollTo('shop');
      return;
    }
    this.openCategoryPage(category);
  }

  selectCategory(category: CategoryFilter): void {
    this.activeCategory.set(category);
  }
  filterCategoryLabel(categoryId: string): string {
    return this.categoryStore
      .path(categoryId)
      .slice(1)
      .map((category) => category.name)
      .join(' / ');
  }
  openSearch(): void {
    this.closeMobileMenu();
    this.searchOpen.set(true);
    if (typeof document !== 'undefined')
      setTimeout(() =>
        document
          .querySelector<HTMLInputElement>('.global-search-input')
          ?.focus(),
      );
  }
  openCart(): void {
    this.closeMobileMenu();
    this.closeSearch();
    this.cart.open.set(true);
    void this.loadPhoneCountries();
  }
  async submitCustomerRequest(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity() || this.requestSubmitting()) return;
    const data = new FormData(form);
    const items = this.cart.items().map((item) => ({
      productId: item.productId,
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      priceLabel: item.priceLabel,
      imageUrl: item.imageUrl,
    }));
    this.requestSubmitting.set(true);
    this.requestError.set('');
    try {
      const request = await this.customerRequests.create(
          String(data.get('name') || ''),
          String(data.get('phone') || ''),
          this.requestPhoneCountry(),
          String(data.get('city') || ''),
          String(data.get('message') || ''),
          items,
        );
      this.cart.clear();
      this.submittedRequest.set(request);
    } catch (error) {
      this.requestError.set(
        error instanceof Error
          ? error.message
          : 'The request could not be saved.',
      );
    } finally {
      this.requestSubmitting.set(false);
    }
  }
  async loadPhoneCountries(): Promise<void> {
    if (this.phoneCountries().length || this.phoneCountriesLoading()) return;
    this.phoneCountriesLoading.set(true);
    try {
      const { createPhoneCountryOptions } = await import('./phone-countries');
      this.phoneCountries.set(await createPhoneCountryOptions());
    } finally {
      this.phoneCountriesLoading.set(false);
    }
  }
  finishCustomerRequest(): void {
    this.cart.clear();
    this.cart.open.set(false);
    this.submittedRequest.set(null);
    this.requestError.set('');
  }
  startNewRequest(): void {
    this.cart.clear();
    this.submittedRequest.set(null);
    this.requestError.set('');
    this.requestPdfError.set('');
  }
  async downloadRequestPdf(request: CustomerRequest): Promise<void> {
    this.requestPdfBusy.set(true);
    this.requestPdfError.set('');
    try {
      const { createRequestPdf } = await import('./request-pdf');
      this.downloadFile(await createRequestPdf(request));
    } catch {
      this.requestPdfError.set('The reservation PDF could not be created.');
    } finally {
      this.requestPdfBusy.set(false);
    }
  }
  async shareRequestPdf(request: CustomerRequest): Promise<void> {
    this.requestPdfBusy.set(true);
    this.requestPdfError.set('');
    try {
      const { createRequestPdf } = await import('./request-pdf');
      const file = await createRequestPdf(request);
      const shareData: ShareData = {
        files: [file],
        title: `BP Fashion Park · ${request.reference}`,
        text: `Availability request ${request.reference}`,
      };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData)))
        await navigator.share(shareData);
      else {
        this.downloadFile(file);
        window.open(this.requestWhatsappUrl(), '_blank', 'noopener');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.requestPdfError.set('The reservation PDF could not be shared.');
    } finally {
      this.requestPdfBusy.set(false);
    }
  }
  private downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  closeSearch(): void {
    this.searchOpen.set(false);
  }
  openSearchProduct(id: string): void {
    this.closeSearch();
    this.openProduct(id);
  }
  async openHome(section = 'new'): Promise<void> {
    this.dismissMegaMenu();
    if (this.router.url.split(/[?#]/)[0] !== '/')
      await this.router.navigate(['/']);
    if (typeof document !== 'undefined')
      setTimeout(() => this.scrollTo(section));
  }
  openCategoryPage(categoryId: string): void {
    this.dismissMegaMenu();
    this.router.navigateByUrl(this.categoryStore.url(categoryId));
  }

  reopenMegaMenu(): void {
    this.megaMenuDismissed.set(false);
  }

  toggleMobileMenu(): void {
    if (this.menuOpen()) {
      this.closeMobileMenu();
      return;
    }
    this.mobileMenuPath.set([]);
    this.menuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.menuOpen.set(false);
    this.mobileMenuPath.set([]);
  }

  openMobileMenuCategory(category: Category): void {
    if (this.categoryStore.children(category.id).length) {
      this.mobileMenuPath.update((path) => [...path, category.id]);
      return;
    }
    this.openCategoryPage(category.id);
  }

  mobileMenuBack(): void {
    this.mobileMenuPath.update((path) => path.slice(0, -1));
  }

  private dismissMegaMenu(): void {
    this.closeMobileMenu();
    this.megaMenuDismissed.set(true);
    if (
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
    )
      document.activeElement.blur();
  }
  async viewAllSearchResults(): Promise<void> {
    this.closeSearch();
    this.activeCategory.set('All');
    if (this.router.url !== '/') await this.router.navigate(['/']);
    if (typeof document !== 'undefined')
      setTimeout(() => this.scrollTo('shop'));
  }
  setLanguage(language: Language): void {
    this.language.set(language);
    if (typeof window !== 'undefined')
      window.localStorage.setItem('bp-fashion-language', language);
  }
  categoryName(id: string): string {
    return this.categoryStore.name(id);
  }
  priceLabel(product: Product): string {
    return this.storeSettings.priceLabel(product);
  }
  originalPriceLabel(product: Product): string {
    return product.originalPrice
      ? this.storeSettings.formatMoney(product.originalPrice)
      : '';
  }
  openProduct(id: string): void {
    const product = this.store.find(id);
    this.router.navigateByUrl(
      product
        ? this.categoryStore.productUrl(product.category, product.id)
        : `/product/${encodeURIComponent(id)}`,
    );
  }
  async logout(): Promise<void> {
    await this.auth.logout();
    this.adminOpen.set(false);
    await this.router.navigate(['/']);
  }

  openCategoryManager(): void {
    if (!this.auth.user()) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.categoryError.set('');
    this.categoryAdminOpen.set(true);
  }

  async addCategory(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get('categoryName')).trim();
    const parentCategoryId = String(data.get('parentCategoryId') || '') || null;
    const slug = this.slugify(name);
    const duplicate = this.categoryStore
      .categories()
      .some(
        (category) =>
          category.parentCategoryId === parentCategoryId &&
          category.slug === slug,
      );
    if (!name || duplicate) {
      this.categoryError.set('Use a unique category name at this level.');
      return;
    }
    const id = parentCategoryId ? `${parentCategoryId}-${slug}` : slug;
    await this.categoryStore.save({
      id,
      slug,
      name,
      description: String(data.get('categoryDescription') || ''),
      parentCategoryId,
      active: true,
      displayOrder: this.categoryStore.categories().length + 1,
    });
    form.reset();
    this.categoryError.set('');
  }

  async toggleCategory(category: Category): Promise<void> {
    await this.categoryStore.save({ ...category, active: !category.active });
  }

  async moveCategory(category: Category, direction: -1 | 1): Promise<void> {
    const siblings = this.categoryStore
      .categories()
      .filter((item) => item.parentCategoryId === category.parentCategoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((item) => item.id === category.id);
    const other = siblings[index + direction];
    if (!other) return;
    const order = category.displayOrder;
    await Promise.all([
      this.categoryStore.save({
        ...category,
        displayOrder: other.displayOrder,
      }),
      this.categoryStore.save({ ...other, displayOrder: order }),
    ]);
  }

  async deleteCategory(category: Category): Promise<void> {
    const inUse = this.products().some(
      (product) =>
        product.category === category.id ||
        this.categoryStore
          .children(category.id)
          .some((child) => child.id === product.category),
    );
    if (inUse) {
      this.categoryError.set(
        'This category still contains products. Move them before deleting it.',
      );
      return;
    }
    await this.categoryStore.remove(category.id);
  }
  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    this.menuOpen.set(false);
  }
  subscribe(event: Event): void {
    event.preventDefault();
    if (this.email().trim()) this.subscribed.set(true);
  }

  editProduct(product: Product): void {
    if (!this.auth.user()) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.editingId.set(product.id);
    this.pendingImages.set([...(product.images ?? [])]);
    this.adminOpen.set(true);
    setTimeout(() => this.fillAdminForm(product));
  }

  newProduct(): void {
    if (!this.auth.user()) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.editingId.set(null);
    this.pendingImages.set([]);
    this.uploadError.set('');
    this.adminOpen.set(true);
    setTimeout(() => this.fillAdminForm());
  }

  async selectImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (!files.length) return;
    this.uploadError.set('');
    this.uploadingImages.set(true);
    try {
      const name = (
        document.querySelector<HTMLInputElement>('input[name="name"]')?.value ||
        'Product'
      ).trim();
      const uploaded = await this.cloudinary.uploadMany(files, name);
      this.pendingImages.update((images) => [...images, ...uploaded]);
    } catch (error) {
      this.uploadError.set(
        error instanceof Error ? error.message : 'Could not upload the images.',
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
      const reordered = [...images];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
  }

  async saveProduct(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const id = this.editingId() ?? `product-${Date.now()}`;
    const existing = this.products().find((item) => item.id === id);
    const product: Product = {
      id,
      name: String(data.get('name')),
      category: String(data.get('category')) as ProductCategory,
      price: Number(data.get('price')),
      art: String(data.get('art')),
      description: String(data.get('description')),
      images: this.pendingImages(),
      colors: this.parseColors(String(data.get('colors'))),
      featured: data.get('featured') === 'on',
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await this.store.save(product);
    this.adminOpen.set(false);
  }

  async deleteProduct(product: Product): Promise<void> {
    await this.store.remove(product.id);
  }

  async deleteEditingProduct(): Promise<void> {
    const product = this.products().find(
      (item) => item.id === this.editingId(),
    );
    if (product) await this.deleteProduct(product);
    this.adminOpen.set(false);
  }

  private parseColors(value: string) {
    return value
      .split(',')
      .map((entry) => {
        const [name = 'Default', hex = '#8a6a55', stock = '0'] = entry
          .trim()
          .split('|');
        return {
          name: name.trim(),
          hex: hex.trim(),
          stock: Math.max(0, Number(stock) || 0),
        };
      })
      .filter((color) => color.name);
  }

  private fillAdminForm(product?: Product): void {
    const form = document.querySelector<HTMLFormElement>('.admin-form');
    if (!form) return;
    (form.elements.namedItem('name') as HTMLInputElement).value =
      product?.name ?? '';
    (form.elements.namedItem('category') as HTMLSelectElement).value =
      product?.category ?? this.rootCategories()[0]?.id ?? '';
    (form.elements.namedItem('price') as HTMLInputElement).value = String(
      product?.price ?? '',
    );
    (form.elements.namedItem('art') as HTMLSelectElement).value =
      product?.art ?? 'bag';
    (form.elements.namedItem('description') as HTMLTextAreaElement).value =
      product?.description ?? '';
    (form.elements.namedItem('colors') as HTMLInputElement).value =
      product?.colors.map((c) => `${c.name}|${c.hex}|${c.stock}`).join(', ') ??
      '';
    (form.elements.namedItem('featured') as HTMLInputElement).checked = Boolean(
      product?.featured,
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

  private startHeroCarousel(): void {
    this.stopHeroCarousel();
    this.heroTimer = setInterval(
      () =>
        this.heroSlide.update((index) => (index + 1) % this.heroSlides.length),
      6500,
    );
  }

  private stopHeroCarousel(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
    this.heroTimer = undefined;
  }

  private updateRouteState(url: string): void {
    const path = url.split(/[?#]/)[0];
    this.isAuthPage.set(path.startsWith('/admin'));
    this.isDetailPage.set(path !== '/');
    if (path === '/') this.seo.setHome();
  }
}
