import { Injectable, computed, inject, signal } from '@angular/core';
import { Category } from './category.model';
import { CategoryRepository } from './category-repository.service';
import { validateCategory } from './catalog-validation';

export const STARTER_CATEGORIES: Category[] = [
  { id: 'women', name: 'Women', slug: 'women', description: 'Clothing, shoes and accessories for her', parentCategoryId: null, active: true, displayOrder: 1 },
  { id: 'men', name: 'Men', slug: 'men', description: 'Modern clothing, shoes and accessories', parentCategoryId: null, active: true, displayOrder: 2 },
  { id: 'children', name: 'Children', slug: 'children', description: 'Clothing, shoes and accessories for children', parentCategoryId: null, active: true, displayOrder: 3 },
  { id: 'unisex', name: 'Unisex', slug: 'unisex', description: 'Shared styles selected for everyone', parentCategoryId: null, active: true, displayOrder: 4 },
  { id: 'beauty-hair', name: 'Beauty & Hair', slug: 'beauty-hair', description: 'Wigs and hair essentials', parentCategoryId: null, active: true, displayOrder: 5 },
  { id: 'travel', name: 'Travel', slug: 'travel', description: 'Suitcases and travel essentials', parentCategoryId: null, active: true, displayOrder: 6 },
  { id: 'women-clothing', name: 'Clothing', slug: 'clothing', description: 'Dresses, skirts and everyday pieces for women', parentCategoryId: 'women', active: true, displayOrder: 10 },
  { id: 'women-shoes', name: 'Shoes', slug: 'shoes', description: 'Shoes for women', parentCategoryId: 'women', active: true, displayOrder: 11 },
  { id: 'women-accessories', name: 'Accessories', slug: 'accessories', description: 'Bags, jewelry and finishing touches for women', parentCategoryId: 'women', active: true, displayOrder: 12 },
  { id: 'men-clothing', name: 'Clothing', slug: 'clothing', description: 'Shirts, trousers and modern essentials for men', parentCategoryId: 'men', active: true, displayOrder: 13 },
  { id: 'men-shoes', name: 'Shoes', slug: 'shoes', description: 'Shoes for men', parentCategoryId: 'men', active: true, displayOrder: 14 },
  { id: 'men-accessories', name: 'Accessories', slug: 'accessories', description: 'Bags, belts and finishing touches for men', parentCategoryId: 'men', active: true, displayOrder: 15 },
  { id: 'children-clothing', name: 'Clothing', slug: 'clothing', description: 'Comfortable everyday clothing for children', parentCategoryId: 'children', active: true, displayOrder: 14 },
  { id: 'children-shoes', name: 'Shoes', slug: 'shoes', description: 'Everyday and occasion footwear for children', parentCategoryId: 'children', active: true, displayOrder: 15 },
  { id: 'children-accessories', name: 'Accessories', slug: 'accessories', description: 'Bags, hats and finishing touches for children', parentCategoryId: 'children', active: true, displayOrder: 16 },
  { id: 'unisex-clothing', name: 'Clothing', slug: 'clothing', description: 'Flexible everyday styles for everyone', parentCategoryId: 'unisex', active: true, displayOrder: 17 },
  { id: 'unisex-shoes', name: 'Shoes', slug: 'shoes', description: 'Shared footwear styles', parentCategoryId: 'unisex', active: true, displayOrder: 18 },
  { id: 'unisex-accessories', name: 'Accessories', slug: 'accessories', description: 'Versatile accessories for every wardrobe', parentCategoryId: 'unisex', active: true, displayOrder: 19 },
  { id: 'beauty-wigs', name: 'Wigs', slug: 'wigs', description: 'Wigs in different styles, colors and lengths', parentCategoryId: 'beauty-hair', active: true, displayOrder: 20 },
  { id: 'women-bags', name: 'Bags', slug: 'bags', description: 'Handbags, totes and everyday bags', parentCategoryId: 'women-accessories', active: true, displayOrder: 21 },
  { id: 'women-jewelry', name: 'Jewelry', slug: 'jewelry', description: 'Necklaces and finishing touches', parentCategoryId: 'women-accessories', active: true, displayOrder: 22 },
  { id: 'women-belts', name: 'Belts', slug: 'belts', description: 'Practical and statement belts', parentCategoryId: 'women-accessories', active: true, displayOrder: 23 },
  { id: 'women-hats', name: 'Hats', slug: 'hats', description: 'Seasonal hats and headwear', parentCategoryId: 'women-accessories', active: true, displayOrder: 24 },
  { id: 'women-sunglasses', name: 'Sunglasses', slug: 'sunglasses', description: 'Everyday sunglasses', parentCategoryId: 'women-accessories', active: true, displayOrder: 25 },
  { id: 'men-bags', name: 'Bags', slug: 'bags', description: 'Bags selected for men', parentCategoryId: 'men-accessories', active: true, displayOrder: 26 },
  { id: 'men-belts', name: 'Belts', slug: 'belts', description: 'Belts for men', parentCategoryId: 'men-accessories', active: true, displayOrder: 27 },
  { id: 'men-hats', name: 'Hats', slug: 'hats', description: 'Hats and headwear for men', parentCategoryId: 'men-accessories', active: true, displayOrder: 28 },
  { id: 'men-sunglasses', name: 'Sunglasses', slug: 'sunglasses', description: 'Sunglasses for men', parentCategoryId: 'men-accessories', active: true, displayOrder: 29 },
  { id: 'children-bags', name: 'Bags', slug: 'bags', description: 'Bags for children', parentCategoryId: 'children-accessories', active: true, displayOrder: 30 },
  { id: 'children-hats', name: 'Hats', slug: 'hats', description: 'Hats for children', parentCategoryId: 'children-accessories', active: true, displayOrder: 31 },
  { id: 'unisex-bags', name: 'Bags', slug: 'bags', description: 'Shared everyday bags', parentCategoryId: 'unisex-accessories', active: true, displayOrder: 32 },
  { id: 'unisex-belts', name: 'Belts', slug: 'belts', description: 'Shared belt styles', parentCategoryId: 'unisex-accessories', active: true, displayOrder: 33 },
  { id: 'unisex-hats', name: 'Hats', slug: 'hats', description: 'Shared hats and headwear', parentCategoryId: 'unisex-accessories', active: true, displayOrder: 34 },
  { id: 'unisex-sunglasses', name: 'Sunglasses', slug: 'sunglasses', description: 'Shared sunglasses', parentCategoryId: 'unisex-accessories', active: true, displayOrder: 35 },
  { id: 'travel-suitcases', name: 'Suitcases', slug: 'suitcases', description: 'Cabin, medium and large suitcases', parentCategoryId: 'travel', active: true, displayOrder: 26 },
  { id: 'women-dresses', name: 'Dresses', slug: 'dresses', description: 'Everyday and occasion dresses', parentCategoryId: 'women-clothing', active: true, displayOrder: 30 },
  { id: 'women-skirts', name: 'Skirts', slug: 'skirts', description: 'Midi, pleated and everyday skirts', parentCategoryId: 'women-clothing', active: true, displayOrder: 31 },
  { id: 'women-jackets-coats', name: 'Jackets & coats', slug: 'jackets-coats', description: 'Layers for every season', parentCategoryId: 'women-clothing', active: true, displayOrder: 32 },
  { id: 'women-sets', name: 'Sets', slug: 'sets', description: 'Coordinated outfits and matching pieces', parentCategoryId: 'women-clothing', active: true, displayOrder: 33 },
  { id: 'women-casual-shoes', name: 'Casual shoes', slug: 'casual-shoes', description: 'Everyday footwear', parentCategoryId: 'women-shoes', active: true, displayOrder: 34 },
  { id: 'women-training-shoes', name: 'Training shoes', slug: 'training-shoes', description: 'Comfortable trainers', parentCategoryId: 'women-shoes', active: true, displayOrder: 35 },
  { id: 'women-boots', name: 'Boots', slug: 'boots', description: 'Seasonal boots', parentCategoryId: 'women-shoes', active: true, displayOrder: 36 },
  { id: 'women-sandals', name: 'Sandals', slug: 'sandals', description: 'Sandals and warm-weather shoes', parentCategoryId: 'women-shoes', active: true, displayOrder: 37 },
  { id: 'men-shirts', name: 'Shirts', slug: 'shirts', description: 'Smart and relaxed shirts', parentCategoryId: 'men-clothing', active: true, displayOrder: 40 },
  { id: 'men-trousers', name: 'Trousers', slug: 'trousers', description: 'Tailored and casual trousers', parentCategoryId: 'men-clothing', active: true, displayOrder: 41 },
  { id: 'men-jackets-coats', name: 'Jackets & coats', slug: 'jackets-coats', description: 'Jackets, coats and seasonal layers', parentCategoryId: 'men-clothing', active: true, displayOrder: 42 },
  { id: 'men-sets', name: 'Sets', slug: 'sets', description: 'Coordinated clothing sets', parentCategoryId: 'men-clothing', active: true, displayOrder: 43 },
  { id: 'men-casual-shoes', name: 'Casual shoes', slug: 'casual-shoes', description: 'Loafers and everyday footwear', parentCategoryId: 'men-shoes', active: true, displayOrder: 44 },
  { id: 'men-training-shoes', name: 'Training shoes', slug: 'training-shoes', description: 'Comfortable performance-inspired trainers', parentCategoryId: 'men-shoes', active: true, displayOrder: 45 },
  { id: 'men-boots', name: 'Boots', slug: 'boots', description: 'Seasonal and everyday boots', parentCategoryId: 'men-shoes', active: true, displayOrder: 46 },
  { id: 'men-sandals', name: 'Sandals', slug: 'sandals', description: 'Sandals and slides', parentCategoryId: 'men-shoes', active: true, displayOrder: 47 },
  { id: 'children-dresses', name: 'Dresses', slug: 'dresses', description: 'Dresses for everyday and occasions', parentCategoryId: 'children-clothing', active: true, displayOrder: 50 },
  { id: 'children-tops', name: 'Shirts & tops', slug: 'shirts-tops', description: 'T-shirts, shirts and tops', parentCategoryId: 'children-clothing', active: true, displayOrder: 51 },
  { id: 'children-trousers', name: 'Trousers', slug: 'trousers', description: 'Trousers and comfortable bottoms', parentCategoryId: 'children-clothing', active: true, displayOrder: 52 },
  { id: 'children-sets', name: 'Sets', slug: 'sets', description: 'Coordinated outfits', parentCategoryId: 'children-clothing', active: true, displayOrder: 53 },
  { id: 'children-jackets-coats', name: 'Jackets & coats', slug: 'jackets-coats', description: 'Warm layers for children', parentCategoryId: 'children-clothing', active: true, displayOrder: 54 },
  { id: 'children-casual-shoes', name: 'Casual shoes', slug: 'casual-shoes', description: 'Everyday children’s shoes', parentCategoryId: 'children-shoes', active: true, displayOrder: 55 },
  { id: 'children-training-shoes', name: 'Training shoes', slug: 'training-shoes', description: 'Comfortable trainers for children', parentCategoryId: 'children-shoes', active: true, displayOrder: 56 },
  { id: 'children-boots', name: 'Boots', slug: 'boots', description: 'Seasonal children’s boots', parentCategoryId: 'children-shoes', active: true, displayOrder: 57 },
  { id: 'children-sandals', name: 'Sandals', slug: 'sandals', description: 'Children’s sandals', parentCategoryId: 'children-shoes', active: true, displayOrder: 58 },
  { id: 'wigs-straight', name: 'Straight wigs', slug: 'straight', description: 'Straight wig styles', parentCategoryId: 'beauty-wigs', active: true, displayOrder: 60 },
  { id: 'wigs-curly', name: 'Curly wigs', slug: 'curly', description: 'Curly and wavy styles', parentCategoryId: 'beauty-wigs', active: true, displayOrder: 61 },
  { id: 'wigs-braided', name: 'Braided wigs', slug: 'braided', description: 'Braided wig styles', parentCategoryId: 'beauty-wigs', active: true, displayOrder: 62 },
  { id: 'wigs-bob', name: 'Bob wigs', slug: 'bob', description: 'Short and bob wig styles', parentCategoryId: 'beauty-wigs', active: true, displayOrder: 63 }
];

@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly repository = inject(CategoryRepository);
  private initialized = false;
  readonly categories = signal<Category[]>(
    this.repository.configured ? [] : STARTER_CATEGORIES,
  );
  readonly loading = signal(this.repository.configured);
  readonly loadError = signal('');
  readonly active = computed(() => {
    const categories = this.categories();
    const byId = new Map(categories.map(category => [category.id, category]));
    return categories.filter(category => {
      let current: Category | undefined = category;
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        if (!current.active) return false;
        visited.add(current.id);
        current = current.parentCategoryId ? byId.get(current.parentCategoryId) : undefined;
      }
      return true;
    }).sort((a, b) => a.displayOrder - b.displayOrder);
  });
  readonly roots = computed(() => this.active().filter(category => !category.parentCategoryId));

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.repository.configured) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.categories.set(await this.repository.list());
    } catch {
      this.categories.set([]);
      this.loadError.set('Categories could not be loaded from the live catalog.');
    } finally {
      this.loading.set(false);
    }
  }

  find(id: string): Category | undefined { return this.categories().find(category => category.id === id); }
  isVisible(id: string): boolean { return this.active().some(category => category.id === id); }
  name(id: string): string { return this.find(id)?.name ?? id; }
  children(parentId: string): Category[] { return this.active().filter(category => category.parentCategoryId === parentId); }
  descendants(parentId: string): Category[] {
    const direct = this.children(parentId);
    return direct.flatMap(category => [category, ...this.descendants(category.id)]);
  }
  path(categoryId: string): Category[] {
    const result: Category[] = [];
    const visited = new Set<string>();
    let current = this.find(categoryId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      result.unshift(current);
      current = current.parentCategoryId ? this.find(current.parentCategoryId) : undefined;
    }
    return result;
  }
  url(categoryId: string): string { return '/' + this.path(categoryId).map(category => category.slug).join('/'); }
  productUrl(categoryId: string, productId: string): string {
    return `${this.url(categoryId)}/product/${encodeURIComponent(productId)}`;
  }
  pathLabel(categoryId: string): string { return this.path(categoryId).map(category => category.name).join(' / '); }
  findByPath(segments: string[]): Category | undefined {
    let parentId: string | null = null;
    let match: Category | undefined;
    for (const segment of segments) {
      match = this.active().find(category => category.parentCategoryId === parentId && category.slug === segment);
      if (!match) return undefined;
      parentId = match.id;
    }
    return match;
  }

  async save(category: Category): Promise<void> {
    const errors = validateCategory(category, this.categories());
    if (errors.length) throw new Error(errors.join(' '));
    const exists = this.find(category.id);
    await this.repository.save(category);
    this.categories.update(items => exists ? items.map(item => item.id === category.id ? category : item) : [...items, category]);
  }

  async seedStarterCategories(): Promise<void> {
    if (!this.repository.configured) throw new Error('Firebase must be connected before importing categories.');
    if (this.categories().length) throw new Error('The catalog already contains categories.');
    await this.repository.saveMany(STARTER_CATEGORIES);
    this.categories.set(STARTER_CATEGORIES.map(category => ({ ...category })));
  }

  async applySimplifiedStructure(): Promise<void> {
    if (!this.repository.configured)
      throw new Error('Firebase must be connected before updating categories.');
    const obsoleteIds = new Set([
      'accessories', 'accessories-bags', 'accessories-jewelry',
      'accessories-belts', 'accessories-hats', 'accessories-sunglasses',
    ]);
    const obsolete = this.categories()
      .filter(category => obsoleteIds.has(category.id))
      .map(category => ({ ...category, active: false }));
    await this.repository.saveMany([...STARTER_CATEGORIES, ...obsolete]);
    const merged = new Map(this.categories().map(category => [category.id, category]));
    [...STARTER_CATEGORIES, ...obsolete].forEach(category => merged.set(category.id, { ...category }));
    this.categories.set([...merged.values()]);
  }

  async remove(id: string): Promise<void> {
    const ids = [id, ...this.descendants(id).map(category => category.id)];
    await Promise.all(ids.map(categoryId => this.repository.remove(categoryId)));
    this.categories.update(items => items.filter(item => !ids.includes(item.id)));
  }
}
