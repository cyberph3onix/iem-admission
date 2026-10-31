import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorText } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
  <div class="container" style="max-width:440px">
    <div class="card">
      <h1>Sign in</h1>
      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field"><label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
          @if (show('email')) { <div class="err">Enter a valid email.</div> }</div>
        <div class="field"><label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          @if (show('password')) { <div class="err">Password is required.</div> }</div>
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <p>New applicant? <a routerLink="/register">Create an account</a></p>
    </div>
  </div>`,
})
export class Login {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  busy = signal(false); error = signal('');
  show(c: 'email' | 'password') { const x = this.form.controls[c]; return x.invalid && (x.touched || x.dirty); }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.home()),
      error: (e) => { this.error.set(errorText(e).message); this.busy.set(false); },
    });
  }
}
