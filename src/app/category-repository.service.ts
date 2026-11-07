import { Injectable, inject } from '@angular/core';
import { collection, deleteDoc, doc, Firestore, getDocs, getFirestore, orderBy, query, setDoc, writeBatch } from 'firebase/firestore';
import { Category } from './category.model';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly firebase = inject(FirebaseAppService);
  private readonly db: Firestore | null;
  readonly configured = this.firebase.configured;

  constructor() {
    this.db = this.firebase.app ? getFirestore(this.firebase.app) : null;
  }

  async list(): Promise<Category[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(query(collection(this.db, 'categories'), orderBy('displayOrder')));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Category));
  }

  async save(category: Category): Promise<void> {
    if (this.db) await setDoc(doc(this.db, 'categories', category.id), category);
  }

  async saveMany(categories: Category[]): Promise<void> {
    if (!this.db) return;
    const batch = writeBatch(this.db);
    for (const category of categories) batch.set(doc(this.db, 'categories', category.id), category);
    await batch.commit();
  }

  async remove(id: string): Promise<void> {
    if (this.db) await deleteDoc(doc(this.db, 'categories', id));
  }
}
