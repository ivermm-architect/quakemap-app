import { Injectable, signal } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

import { firebaseConfig } from './firebase-config';

/**
 * AuthService
 * Envuelve Firebase Authentication (email + contraseña) y expone el estado
 * de sesión mediante signals para el "gate" de entrada.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly app: FirebaseApp = initializeApp(firebaseConfig);
  private readonly auth: Auth = getAuth(this.app);

  /**
   * Estado de sesión:
   *  - `undefined` → aún resolviendo (carga inicial),
   *  - `null`      → sin sesión,
   *  - `User`      → autenticado.
   */
  readonly user = signal<User | null | undefined>(undefined);

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.user.set(user));
  }

  /** Crea una cuenta nueva con email y contraseña. */
  register(email: string, password: string): Promise<unknown> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  /** Inicia sesión con email y contraseña. */
  login(email: string, password: string): Promise<unknown> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /** Inicia sesión (o registra) con la cuenta de Google mediante popup. */
  loginWithGoogle(): Promise<unknown> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  /** Cierra la sesión actual. */
  logout(): Promise<void> {
    return signOut(this.auth);
  }

  /** Traduce los códigos de error de Firebase a mensajes en español. */
  messageFor(code: string): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'El correo no es válido.';
      case 'auth/email-already-in-use':
        return 'Ese correo ya está registrado.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/missing-password':
        return 'Escribe una contraseña.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Inténtalo más tarde.';
      case 'auth/network-request-failed':
        return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
      case 'auth/operation-not-allowed':
        return 'El acceso por email no está habilitado en Firebase.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Cerraste la ventana de Google antes de terminar.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permite los pop-ups.';
      case 'auth/account-exists-with-different-credential':
        return 'Ya existe una cuenta con ese correo usando otro método.';
      default:
        return 'No se pudo completar. Inténtalo de nuevo.';
    }
  }
}
