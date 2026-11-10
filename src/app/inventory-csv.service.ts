import { Injectable } from '@angular/core';
import {
  Product,
  ProductPublicationStatus,
  productStatus,
  totalStock,
} from './product.model';

export interface InventoryCsvChange {
  product: Product;
  stock: number;
  status: ProductPublicationStatus;
  lowStockThreshold: number;
  price: number;
  changedFields: string[];
}

export interface InventoryCsvPreview {
  changes: InventoryCsvChange[];
  unchanged: number;
  errors: string[];
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryCsvService {
  export(products: Product[], categoryPath: (id: string) => string): void {
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Publication Status',
      'Stock',
      'Low Stock Threshold',
      'Price',
    ];
    const rows = products.map((product) => [
      product.sku ?? '',
      product.name,
      categoryPath(product.category),
      productStatus(product),
      String(totalStock(product)),
      String(product.lowStockThreshold ?? 3),
      String(product.price),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCell(cell)).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bp-fashion-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async parse(file: File, products: Product[]): Promise<InventoryCsvPreview> {
    if (file.size > 2 * 1024 * 1024)
      throw new Error('The CSV file must not exceed 2 MB.');
    const table = this.parseCsv((await file.text()).replace(/^\uFEFF/, ''));
    if (table.length < 2)
      throw new Error('The CSV file does not contain inventory rows.');
    if (table.length > 1001)
      throw new Error('Import no more than 1,000 products at a time.');
    const header = table[0].map((value) => value.trim().toLowerCase());
    const required = [
      'sku',
      'publication status',
      'stock',
      'low stock threshold',
      'price',
    ];
    const missing = required.filter((name) => !header.includes(name));
    if (missing.length)
      throw new Error(`Missing CSV columns: ${missing.join(', ')}.`);
    const index = (name: string) => header.indexOf(name);
    const bySku = new Map(
      products
        .filter((product) => product.sku)
        .map((product) => [product.sku!.toLowerCase(), product]),
    );
    const seen = new Set<string>();
    const changes: InventoryCsvChange[] = [];
    const errors: string[] = [];
    let unchanged = 0;
    for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
      const row = table[rowIndex];
      if (row.every((cell) => !cell.trim())) continue;
      const line = rowIndex + 1;
      const sku = (row[index('sku')] ?? '').trim();
      const key = sku.toLowerCase();
      if (!sku) {
        errors.push(`Row ${line}: SKU is required.`);
        continue;
      }
      if (seen.has(key)) {
        errors.push(`Row ${line}: SKU ${sku} appears more than once.`);
        continue;
      }
      seen.add(key);
      const product = bySku.get(key);
      if (!product) {
        errors.push(`Row ${line}: SKU ${sku} does not match an existing product.`);
        continue;
      }
      const status = (row[index('publication status')] ?? '').trim().toLowerCase();
      if (!['draft', 'published', 'hidden', 'archived'].includes(status)) {
        errors.push(`Row ${line}: invalid publication status for ${sku}.`);
        continue;
      }
      const stock = Number(row[index('stock')]);
      const threshold = Number(row[index('low stock threshold')]);
      const price = Number(row[index('price')]);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
        errors.push(`Row ${line}: stock for ${sku} must be a whole number from 0 to 100,000.`);
        continue;
      }
      if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100000) {
        errors.push(`Row ${line}: low-stock threshold for ${sku} is invalid.`);
        continue;
      }
      if (!Number.isFinite(price) || price < 0 || price > 1000000) {
        errors.push(`Row ${line}: price for ${sku} is invalid.`);
        continue;
      }
      if ((product.priceMode ?? 'fixed') !== 'on-request' && price <= 0) {
        errors.push(`Row ${line}: price for ${sku} must be greater than zero.`);
        continue;
      }
      const changedFields: string[] = [];
      if (totalStock(product) !== stock) changedFields.push('stock');
      if (productStatus(product) !== status) changedFields.push('status');
      if ((product.lowStockThreshold ?? 3) !== threshold)
        changedFields.push('threshold');
      if (product.price !== price) changedFields.push('price');
      if (!changedFields.length) {
        unchanged++;
        continue;
      }
      changes.push({
        product,
        stock,
        status: status as ProductPublicationStatus,
        lowStockThreshold: threshold,
        price,
        changedFields,
      });
    }
    return { changes, unchanged, errors, fileName: file.name };
  }

  private escapeCell(value: string): string {
    let safe = value;
    if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  private parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < content.length; index++) {
      const char = content[index];
      if (char === '"') {
        if (quoted && content[index + 1] === '"') {
          cell += '"';
          index++;
        } else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && content[index + 1] === '\n') index++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += char;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
}
