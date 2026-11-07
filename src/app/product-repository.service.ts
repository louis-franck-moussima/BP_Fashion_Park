import { Injectable, inject } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, Firestore, getDocs, getFirestore, orderBy, query, setDoc } from 'firebase/firestore';
import { Product } from './product.model';
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
    const snapshot = await getDocs(query(collection(this.db, 'products'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(item => {
      const data = item.data() as Partial<Product>;
      const legacyCategory = String(data.category ?? '');
      const category = ['Women', 'Men', 'Accessories', 'Travel'].includes(legacyCategory) ? legacyCategory.toLowerCase() : legacyCategory;
      return { ...data, id: item.id, category, images: data.images ?? [], colors: data.colors ?? [] } as Product;
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
}
