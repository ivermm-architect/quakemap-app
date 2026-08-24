import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth';

/**
 * AuthGate
 * Pantalla de acceso (login / registro) con email y contraseña.
 * Al autenticarse, `AuthService.user` cambia y `App` muestra la app.
 */
@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class AuthGate {
  private readonly auth = inject(AuthService);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected email = '';
  protected password = '';

  protected toggleMode(): void {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.email, this.password);
      } else {
        await this.auth.login(this.email, this.password);
      }
      // onAuthStateChanged actualiza el estado y el gate muestra la app.
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? '';
      this.error.set(this.auth.messageFor(code));
    } finally {
      this.busy.set(false);
    }
  }

  protected async loginWithGoogle(): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.loginWithGoogle();
      // onAuthStateChanged actualiza el estado y el gate muestra la app.
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? '';
      // El usuario cerró el popup: no es un error que mostrar.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.error.set(this.auth.messageFor(code));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
