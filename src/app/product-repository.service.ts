import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  getDocs,
  getDoc,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import {
  Product,
  ProductPurchasingInfo,
  ProductPublicationStatus,
  StockMovement,
  StockMovementReason,
  totalStock,
} from './product.model';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({ providedIn: 'root' })
export class ProductRepository {
  private readonly firebase = inject(FirebaseAppService);
  private readonly db: Firestore | null;
  readonly firebaseConfigured = this.firebase.configured;

  constructor() {
    this.db = this.firebase.app ? getFirestore(this.firebase.app) : null;
  }

  async list(): Promise<Product[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(
      query(collection(this.db, 'products'), orderBy('createdAt', 'desc')),
    );
    return snapshot.docs.map((item) => {
      const data = item.data() as Partial<Product>;
      const legacyCategory = String(data.category ?? '');
      const category = ['Women', 'Men', 'Accessories', 'Travel'].includes(
        legacyCategory,
      )
        ? legacyCategory.toLowerCase()
        : legacyCategory;
      return {
        ...data,
        id: item.id,
        category,
        images: data.images ?? [],
        colors: data.colors ?? [],
      } as Product;
    });
  }

  async save(product: Product): Promise<string> {
    if (!this.db) return product.id;
    const payload = { ...product };
    if (product.id) {
      await setDoc(doc(this.db, 'products', product.id), payload);
      return product.id;
    }
    const created = await addDoc(collection(this.db, 'products'), payload);
    return created.id;
  }

  async remove(id: string): Promise<void> {
    if (this.db)
      await Promise.all([
        deleteDoc(doc(this.db, 'products', id)),
        deleteDoc(doc(this.db, 'productPurchasing', id)),
      ]);
  }

  async listPurchasingInfo(): Promise<ProductPurchasingInfo[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(collection(this.db, 'productPurchasing'));
    return snapshot.docs.map(
      (item) => ({ productId: item.id, ...item.data() }) as ProductPurchasingInfo,
    );
  }

  async purchasingInfo(productId: string): Promise<ProductPurchasingInfo | null> {
    if (!this.db) return null;
    const snapshot = await getDoc(doc(this.db, 'productPurchasing', productId));
    return snapshot.exists()
      ? ({ productId, ...snapshot.data() } as ProductPurchasingInfo)
      : null;
  }

  async savePurchasingInfo(info: ProductPurchasingInfo): Promise<void> {
    if (!this.db) return;
    await setDoc(doc(this.db, 'productPurchasing', info.productId), info);
  }

  async adjustStock(
    productId: string,
    delta: number,
    reason: StockMovementReason,
    colorName?: string,
  ): Promise<StockMovement> {
    if (!this.db)
      throw new Error('Firebase must be connected to adjust stock.');
    const productRef = doc(this.db, 'products', productId);
    const movementRef = doc(
      collection(this.db, 'products', productId, 'stockHistory'),
    );
    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error('This product no longer exists.');
      const product = snapshot.data() as Product;
      const previousStock = totalStock(product);
      const newStock = previousStock + delta;
      if (!Number.isInteger(delta) || delta === 0)
        throw new Error('Stock adjustment must be a non-zero whole number.');
      if (newStock < 0) throw new Error('Stock cannot be reduced below zero.');
      let colors = product.colors;
      if (colorName) {
        if (colors.some((color) => color.stock === undefined))
          throw new Error('Allocate the existing stock by color in the product editor first.');
        const selected = colors.find(
          (color) => color.name.toLowerCase() === colorName.toLowerCase(),
        );
        if (!selected) throw new Error('The selected color no longer exists.');
        if ((selected.stock ?? 0) + delta < 0)
          throw new Error(`${selected.name} stock cannot be reduced below zero.`);
        colors = colors.map((color) =>
          color.name === selected.name
            ? { ...color, stock: (color.stock ?? 0) + delta }
            : color,
        );
      }
      const movement: StockMovement = {
        id: movementRef.id,
        productId,
        delta,
        previousStock,
        newStock,
        reason,
        ...(colorName ? { color: colorName } : {}),
        createdAt: Date.now(),
      };
      transaction.update(productRef, colorName ? { colors } : { stock: newStock });
      transaction.set(movementRef, movement);
      return movement;
    });
  }

  async applyInventoryChange(
    productId: string,
    stock: number,
    status: ProductPublicationStatus,
    lowStockThreshold: number,
    price: number,
  ): Promise<{ product: Product; movement: StockMovement | null }> {
    if (!this.db) throw new Error('Firebase must be connected to import inventory.');
    const productRef = doc(this.db, 'products', productId);
    const movementRef = doc(collection(this.db, 'products', productId, 'stockHistory'));
    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error('A product in the CSV no longer exists.');
      const current = { id: snapshot.id, ...snapshot.data() } as Product;
      const previousStock = totalStock(current);
      const delta = stock - previousStock;
      const removeOriginalPrice = Boolean(current.originalPrice && current.originalPrice <= price);
      transaction.update(productRef, {
        stock,
        status,
        lowStockThreshold,
        price,
        ...(removeOriginalPrice ? { originalPrice: deleteField() } : {}),
      });
      let movement: StockMovement | null = null;
      if (delta) {
        movement = {
          id: movementRef.id,
          productId,
          delta,
          previousStock,
          newStock: stock,
          reason: delta > 0 ? 'restock' : 'decrease',
          createdAt: Date.now(),
        };
        transaction.set(movementRef, movement);
      }
      const product: Product = {
        ...current,
        stock,
        status,
        lowStockThreshold,
        price,
      };
      if (removeOriginalPrice) delete product.originalPrice;
      return { product, movement };
    });
  }

  async stockHistory(productId: string): Promise<StockMovement[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(
      query(
        collection(this.db, 'products', productId, 'stockHistory'),
        orderBy('createdAt', 'desc'),
        limit(30),
      ),
    );
    return snapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() }) as StockMovement,
    );
  }

  async recentStockHistory(): Promise<StockMovement[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(
      query(
        collectionGroup(this.db, 'stockHistory'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
    );
    return snapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() }) as StockMovement,
    );
  }
}
