import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

@Component({ selector: 'app-admin-forgot-password', imports: [RouterLink], templateUrl: './admin-forgot-password.component.html', styleUrl: './admin-login.component.css' })
export class AdminForgotPasswordComponent {
  readonly auth = inject(AdminAuthService);
  readonly error = signal('');
  readonly sent = signal(false);
  readonly submitting = signal(false);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const email = String(new FormData(event.target as HTMLFormElement).get('email') || '').trim();
    this.error.set(''); this.submitting.set(true);
    try { await this.auth.resetPassword(email); this.sent.set(true); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to send the reset email.'); }
    finally { this.submitting.set(false); }
  }
}
