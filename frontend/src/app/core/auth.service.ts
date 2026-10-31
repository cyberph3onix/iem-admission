import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { User } from './models';

// On localhost (ng serve) talk to the local backend; when deployed it is same-origin (Vercel routes /api to the backend).
export const API_URL = location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
// POC choice: JWT in localStorage. It is simple but readable by any injected script (XSS);
// production systems usually prefer httpOnly cookies.
const TOKEN_KEY = 'iem_token';
const USER_KEY = 'iem_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly user = signal<User | null>(this.readUser());
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  get isLoggedIn(): boolean { return !!this.token && !!this.user(); }

  login(email: string, password: string) {
    return this.http.post<{ data: { user: User; token: string } }>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap((r) => this.store(r.data)));
  }
  register(body: { name: string; email: string; password: string; contactNumber?: string }) {
    return this.http.post<{ data: { user: User; token: string } }>(`${API_URL}/auth/register`, body)
      .pipe(tap((r) => this.store(r.data)));
  }
  /** Clears the client token. A JWT already issued stays valid until it expires (no server revocation in this POC). */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }
  home(): string { return this.user()?.role === 'admin' ? '/admin' : '/applicant'; }

  private store(d: { user: User; token: string }) {
    localStorage.setItem(TOKEN_KEY, d.token);
    localStorage.setItem(USER_KEY, JSON.stringify(d.user));
    this.user.set(d.user);
  }
  private readUser(): User | null {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }
}
