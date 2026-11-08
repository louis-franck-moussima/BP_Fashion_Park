import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import {
  Product,
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
    if (this.db) await deleteDoc(doc(this.db, 'products', id));
  }

  async adjustStock(
    productId: string,
    delta: number,
    reason: StockMovementReason,
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
      const movement: StockMovement = {
        id: movementRef.id,
        productId,
        delta,
        previousStock,
        newStock,
        reason,
        createdAt: Date.now(),
      };
      transaction.update(productRef, { stock: newStock });
      transaction.set(movementRef, movement);
      return movement;
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
}
