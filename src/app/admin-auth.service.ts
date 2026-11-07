import { Injectable, inject, signal } from '@angular/core';
import { Auth, User, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly auth: Auth | null;
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly configured = this.firebase.configured;

  constructor() {
    if (this.firebase.app) {
      this.auth = getAuth(this.firebase.app);
      onAuthStateChanged(this.auth, user => { this.user.set(user); this.loading.set(false); });
    } else {
      this.auth = null;
      this.loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Authentication is not configured yet.');
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch {
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
