import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { FirebaseAppService } from './firebase-app.service';
import { AdminActivity, NewAdminActivity } from './admin-activity.model';

@Injectable({ providedIn: 'root' })
export class AdminActivityService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly db = this.firebase.app ? getFirestore(this.firebase.app) : null;
  readonly activities = signal<AdminActivity[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  async initialize(): Promise<void> {
    if (!this.db) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const snapshot = await getDocs(
        query(collection(this.db, 'adminActivity'), orderBy('createdAt', 'desc'), limit(200)),
      );
      this.activities.set(
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AdminActivity),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Activity history could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async record(input: NewAdminActivity): Promise<void> {
    if (!this.db) return;
    const reference = doc(collection(this.db, 'adminActivity'));
    const activity: AdminActivity = {
      ...input,
      id: reference.id,
      createdAt: Date.now(),
    };
    await setDoc(reference, activity);
    this.activities.update((items) => [activity, ...items].slice(0, 200));
  }
}
