import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, User, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseAppService } from './firebase-app.service';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly auth: Auth | null;
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly isOwner = computed(
    () => this.user()?.uid === environment.adminUid,
  );
  readonly configured = this.firebase.configured;
  private resolveReady!: () => void;
  private readonly readyPromise = new Promise<void>(
    (resolve) => (this.resolveReady = resolve),
  );

  constructor() {
    if (this.firebase.app) {
      this.auth = getAuth(this.firebase.app);
      onAuthStateChanged(this.auth, user => {
        this.user.set(user);
        this.loading.set(false);
        this.resolveReady();
      });
    } else {
      this.auth = null;
      this.loading.set(false);
      this.resolveReady();
    }
  }

  whenReady(): Promise<void> { return this.readyPromise; }

  async login(email: string, password: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Authentication is not configured yet.');
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      if (credential.user.uid !== environment.adminUid) {
        await signOut(this.auth);
        throw new Error('This account is not authorized for the owner workspace.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not authorized'))
        throw error;
      throw new Error('The email or password is incorrect.');
    }
  }

  async logout(): Promise<void> { if (this.auth) await signOut(this.auth); }

  async resetPassword(email: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Authentication is not configured yet.');
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch {
      throw new Error('We could not send the reset email. Check the address and try again.');
    }
  }
}
