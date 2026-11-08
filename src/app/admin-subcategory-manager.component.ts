import { Component, computed, inject, signal } from '@angular/core';
import { CategoryStore } from './category-store.service';
import { ProductStore } from './product-store.service';
import { Category } from './category.model';
import { validateCategory } from './catalog-validation';

@Component({
  selector: 'app-admin-subcategory-manager',
  templateUrl: './admin-subcategory-manager.component.html',
  styleUrl: './admin-subcategory-manager.component.css',
})
export class AdminSubcategoryManagerComponent {
  readonly categoryStore = inject(CategoryStore);
  private readonly productStore = inject(ProductStore);
  readonly editingId = signal<string | null>(null);
  readonly selectedBranch = signal('all');
  readonly error = signal('');
  readonly notice = signal('');
  readonly saving = signal(false);

  readonly roots = this.categoryStore.roots;
  readonly subcategories = computed(() => {
    const branch = this.selectedBranch();
    return this.categoryStore
      .categories()
      .filter((category) => category.parentCategoryId)
      .filter(
        (category) =>
          branch === 'all' ||
          this.categoryStore.path(category.id)[0]?.id === branch,
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  });
  readonly availableParents = computed(() => {
    const editingId = this.editingId();
    return this.categoryStore
      .categories()
      .filter(
        (category) =>
          category.id !== editingId &&
          !this.categoryStore
            .path(category.id)
            .some((item) => item.id === editingId),
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  });

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity() || this.saving()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const parentCategoryId = String(data.get('parentCategoryId') || '');
    const existing = this.editingId()
      ? this.categoryStore.find(this.editingId()!)
      : undefined;
    const slug = this.slugify(name);
    const category: Category = {
      ...(existing ?? {}),
      id: existing?.id ?? `${parentCategoryId}-${slug}`,
      name,
      slug,
      description: String(data.get('description') || '').trim(),
      parentCategoryId,
      active: existing?.active ?? true,
      displayOrder:
        existing?.displayOrder ?? this.categoryStore.categories().length + 1,
    };
    const errors = validateCategory(category, this.categoryStore.categories());
    if (errors.length) {
      this.error.set(errors.join(' '));
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.categoryStore.save(category);
      form.reset();
      this.editingId.set(null);
      this.notice.set(`Subcategory “${category.name}” saved.`);
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not save subcategory.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  edit(category: Category): void {
    this.editingId.set(category.id);
    this.error.set('');
    this.notice.set('');
    setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>('.subcategory-form');
      if (!form) return;
      (form.elements.namedItem('name') as HTMLInputElement).value = category.name;
      (form.elements.namedItem('parentCategoryId') as HTMLSelectElement).value =
        category.parentCategoryId ?? '';
      (form.elements.namedItem('description') as HTMLInputElement).value =
        category.description;
      form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });
  }

  cancel(form: HTMLFormElement): void {
    form.reset();
    this.editingId.set(null);
    this.error.set('');
  }

  async toggle(category: Category): Promise<void> {
    try {
      await this.categoryStore.save({ ...category, active: !category.active });
      this.notice.set(
        `${category.name} is now ${category.active ? 'hidden' : 'visible'}.`,
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Update failed.');
    }
  }

  async remove(category: Category): Promise<void> {
    const branchIds = new Set([
      category.id,
      ...this.categoryStore.descendants(category.id).map((item) => item.id),
    ]);
    if (this.productStore.products().some((product) => branchIds.has(product.category))) {
      this.error.set('Move products out of this subcategory branch before deleting it.');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete ${category.name} and its empty child subcategories?`)
    )
      return;
    try {
      await this.categoryStore.remove(category.id);
      if (this.editingId() === category.id)
        this.editingId.set(null);
      this.notice.set(`Subcategory “${category.name}” deleted.`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Delete failed.');
    }
  }

  productCount(category: Category): number {
    const ids = new Set([
      category.id,
      ...this.categoryStore.descendants(category.id).map((item) => item.id),
    ]);
    return this.productStore.products().filter((product) => ids.has(product.category)).length;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
