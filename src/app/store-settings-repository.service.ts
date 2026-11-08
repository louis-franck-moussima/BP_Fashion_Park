import { Injectable, inject } from '@angular/core';
import {
  doc,
  Firestore,
  getDoc,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import { FirebaseAppService } from './firebase-app.service';
import { StoreSettings } from './store-settings.model';

@Injectable({ providedIn: 'root' })
export class StoreSettingsRepository {
  private readonly firebase = inject(FirebaseAppService);
  private readonly db: Firestore | null;
  readonly configured = this.firebase.configured;

  constructor() {
    this.db = this.firebase.app ? getFirestore(this.firebase.app) : null;
  }

  async get(): Promise<StoreSettings | null> {
    if (!this.db) return null;
    const snapshot = await getDoc(doc(this.db, 'settings', 'store'));
    return snapshot.exists() ? (snapshot.data() as StoreSettings) : null;
  }

  async save(settings: StoreSettings): Promise<void> {
    if (!this.db) throw new Error('Firebase is not connected.');
    await setDoc(doc(this.db, 'settings', 'store'), settings);
  }
}
