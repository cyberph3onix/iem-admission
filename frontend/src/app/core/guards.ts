import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Guards are UX only: the server enforces real authorization.
export const roleGuard = (role: 'applicant' | 'admin'): CanActivateFn => () => {
  const auth = inject(AuthService); const router = inject(Router);
  if (!auth.isLoggedIn) return router.parseUrl('/login');
  return auth.user()!.role === role ? true : router.parseUrl(auth.home());
};
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn ? inject(Router).parseUrl(auth.home()) : true;
};
