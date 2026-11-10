import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseAppService } from './firebase-app.service';
import {
  CustomerRequest,
  CustomerRequestStatus,
} from './customer-request.model';

@Injectable({ providedIn: 'root' })
export class CustomerRequestRepository {
  private readonly firebase = inject(FirebaseAppService);
  private readonly db: Firestore | null;
  readonly configured = this.firebase.configured;

  constructor() {
    this.db = this.firebase.app ? getFirestore(this.firebase.app) : null;
  }

  async create(
    input: Omit<
      CustomerRequest,
      'id' | 'reference' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<CustomerRequest> {
    if (!this.db) throw new Error('Requests are temporarily unavailable.');
    const requestRef = doc(collection(this.db, 'customerRequests'));
    const now = Date.now();
    const request: CustomerRequest = {
      ...input,
      id: requestRef.id,
      reference: `BP-${new Date(now).getFullYear()}-${requestRef.id.slice(0, 6).toUpperCase()}`,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(requestRef, request);
    return request;
  }

  async list(): Promise<CustomerRequest[]> {
    if (!this.db) return [];
    const snapshot = await getDocs(
      query(
        collection(this.db, 'customerRequests'),
        orderBy('createdAt', 'desc'),
        limit(200),
      ),
    );
    return snapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() }) as CustomerRequest,
    );
  }

  async updateStatus(id: string, status: CustomerRequestStatus): Promise<void> {
    if (!this.db) throw new Error('Firebase is not connected.');
    await updateDoc(doc(this.db, 'customerRequests', id), {
      status,
      updatedAt: Date.now(),
    });
  }

  async updateFollowUp(
    id: string,
    ownerNotes: string,
    followUpAt: number | null,
  ): Promise<void> {
    if (!this.db) throw new Error('Firebase is not connected.');
    await updateDoc(doc(this.db, 'customerRequests', id), {
      ownerNotes,
      followUpAt,
      updatedAt: Date.now(),
    });
  }
}
