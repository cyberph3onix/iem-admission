import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register').then((m) => m.Register) },
  { path: 'applicant', canActivate: [roleGuard('applicant')], loadComponent: () => import('./features/applicant/applicant-dashboard').then((m) => m.ApplicantDashboard) },
  { path: 'admin', canActivate: [roleGuard('admin')], loadComponent: () => import('./features/admin/admin-review').then((m) => m.AdminReview) },
  { path: 'admin/applications/:id', canActivate: [roleGuard('admin')], loadComponent: () => import('./features/admin/admin-detail').then((m) => m.AdminDetail) },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
