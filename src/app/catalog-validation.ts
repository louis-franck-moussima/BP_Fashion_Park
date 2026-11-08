import { Category } from './category.model';
import { Product } from './product.model';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unique = (values: string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase())).size ===
  values.length;

export function validateProduct(
  product: Product,
  validCategoryIds?: Set<string>,
): string[] {
  const errors: string[] = [];
  if (product.name.length < 2 || product.name.length > 100)
    errors.push('Product name must contain 2–100 characters.');
  if (!product.sku || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(product.sku))
    errors.push(
      'SKU must contain 2–40 letters, numbers, dots, dashes or underscores.',
    );
  if (
    !product.category ||
    (validCategoryIds && !validCategoryIds.has(product.category))
  )
    errors.push('Choose an existing visible category.');
  if (!['fixed', 'from', 'on-request'].includes(product.priceMode ?? 'fixed'))
    errors.push('Choose a valid price mode.');
  if (
    !Number.isFinite(product.price) ||
    product.price < 0 ||
    product.price > 1_000_000
  )
    errors.push('Enter a valid price between €0 and €1,000,000.');
  if (product.priceMode !== 'on-request' && product.price <= 0)
    errors.push('Fixed and starting prices must be greater than €0.');
  if (
    product.originalPrice !== undefined &&
    (!Number.isFinite(product.originalPrice) ||
      product.originalPrice <= product.price ||
      product.originalPrice > 1_000_000)
  )
    errors.push('Original price must be higher than the current price.');
  if (
    !Number.isInteger(product.stock) ||
    (product.stock ?? 0) < 0 ||
    (product.stock ?? 0) > 100_000
  )
    errors.push('Stock must be a whole number between 0 and 100,000.');
  if (
    !Number.isInteger(product.lowStockThreshold) ||
    (product.lowStockThreshold ?? 0) < 0 ||
    (product.lowStockThreshold ?? 0) > 100_000
  )
    errors.push(
      'Low-stock threshold must be a whole number between 0 and 100,000.',
    );
  if (product.description.length < 10 || product.description.length > 1_000)
    errors.push('Description must contain 10–1,000 characters.');
  if (!product.images.length) errors.push('Add at least one product image.');
  if (
    product.images.length > 8 ||
    product.images.some((image) => !image.url || image.url.length > 2_000)
  )
    errors.push('Use 1–8 valid product images.');
  if (!product.colors.length || product.colors.length > 20)
    errors.push('Add between 1 and 20 colors.');
  if (
    product.colors.some(
      (color) =>
        !color.name || color.name.length > 40 || !HEX_COLOR.test(color.hex),
    )
  )
    errors.push(
      'Each color needs a name and a six-digit hex value such as #222222.',
    );
  if (!unique(product.colors.map((color) => color.name)))
    errors.push('Color names must be unique.');
  for (const [label, values, maximum] of [
    ['sizes', product.sizes ?? [], 30],
    ['audiences', product.audiences ?? [], 10],
    ['tags', product.tags ?? [], 30],
  ] as const) {
    if (
      values.length > maximum ||
      values.some((value) => !value || value.length > 50) ||
      !unique([...values])
    )
      errors.push(
        `Use unique, non-empty ${label} with no more than ${maximum} entries.`,
      );
  }
  if ((product.ageRange ?? '').length > 80)
    errors.push('Age range must not exceed 80 characters.');
  const related = product.relatedProductIds ?? [];
  if (related.length > 8 || !unique(related) || related.includes(product.id))
    errors.push(
      'Choose no more than 8 unique related products and do not select the product itself.',
    );
  const wigValues = product.wigDetails ? Object.values(product.wigDetails) : [];
  if (wigValues.some((value) => value && value.length > 80))
    errors.push('Each wig detail must not exceed 80 characters.');
  return [...new Set(errors)];
}

export function validateCategory(
  category: Category,
  categories: Category[],
): string[] {
  const errors: string[] = [];
  if (category.name.length < 2 || category.name.length > 60)
    errors.push('Category name must contain 2–60 characters.');
  if (!SLUG.test(category.slug) || category.slug.length > 80)
    errors.push('Category name must create a valid URL slug.');
  if (category.description.length > 240)
    errors.push('Category description must not exceed 240 characters.');
  if (!Number.isInteger(category.displayOrder) || category.displayOrder < 0)
    errors.push('Category order must be a positive whole number.');
  if (
    category.parentCategoryId &&
    !categories.some((item) => item.id === category.parentCategoryId)
  )
    errors.push('Choose an existing parent category.');
  if (category.parentCategoryId === category.id)
    errors.push('A category cannot be its own parent.');
  if (category.parentCategoryId) {
    const byId = new Map(categories.map((item) => [item.id, item]));
    const visited = new Set<string>();
    let current = byId.get(category.parentCategoryId);
    while (current && !visited.has(current.id)) {
      if (current.id === category.id) {
        errors.push(
          'A category cannot be moved inside one of its subcategories.',
        );
        break;
      }
      visited.add(current.id);
      current = current.parentCategoryId
        ? byId.get(current.parentCategoryId)
        : undefined;
    }
  }
  const duplicate = categories.some(
    (item) =>
      item.id !== category.id &&
      item.parentCategoryId === category.parentCategoryId &&
      item.slug === category.slug,
  );
  if (duplicate)
    errors.push(
      'A category with this name already exists at the selected level.',
    );
  return errors;
}
