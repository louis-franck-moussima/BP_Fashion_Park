import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.error.set('');
    this.submitting.set(true);
    try {
      await this.auth.login(String(data.get('email')), String(data.get('password')));
      await this.router.navigate(['/']);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      this.submitting.set(false);
    }
  }
}
