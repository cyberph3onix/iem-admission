import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorText } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
  <div class="container" style="max-width:480px">
    <div class="card">
      <h1>Create applicant account</h1>
      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field"><label for="name">Full name</label>
          <input id="name" formControlName="name" autocomplete="name" />
          @if (msg('name')) { <div class="err">{{ msg('name') }}</div> }</div>
        <div class="field"><label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          @if (msg('email')) { <div class="err">{{ msg('email') }}</div> }</div>
        <div class="field"><label for="contactNumber">Contact number (optional)</label>
          <input id="contactNumber" formControlName="contactNumber" autocomplete="tel" />
          @if (msg('contactNumber')) { <div class="err">{{ msg('contactNumber') }}</div> }</div>
        <div class="field"><label for="password">Password (min 8 characters)</label>
          <input id="password" type="password" formControlName="password" autocomplete="new-password" />
          @if (msg('password')) { <div class="err">{{ msg('password') }}</div> }</div>
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Register' }}</button>
      </form>
      <p>Already registered? <a routerLink="/login">Sign in</a></p>
    </div>
  </div>`,
})
export class Register {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);
  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    contactNumber: ['', Validators.pattern(/^[0-9+\-\s]{7,15}$|^$/)],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  busy = signal(false); error = signal(''); serverErrors = signal<Record<string, string>>({});
  msg(c: 'name' | 'email' | 'contactNumber' | 'password') {
    const x = this.form.controls[c];
    if (this.serverErrors()[c]) return this.serverErrors()[c];
    return x.invalid && (x.touched || x.dirty) ? ({ name: 'Name is required.', email: 'Enter a valid email.', contactNumber: 'Enter a valid phone number.', password: 'At least 8 characters.' })[c] : '';
  }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set(''); this.serverErrors.set({});
    const v = this.form.getRawValue();
    this.auth.register({ ...v, contactNumber: v.contactNumber || undefined }).subscribe({
      next: () => this.router.navigateByUrl(this.auth.home()),
      error: (e) => { const r = errorText(e); this.error.set(r.message); this.serverErrors.set(r.errors); this.busy.set(false); },
    });
  }
}
