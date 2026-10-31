import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `
  <header class="top"><div class="container">
    <strong>IEM Admission System <span style="font-weight:400">(POC)</span></strong>
    @if (auth.user(); as u) {
      <span>{{ u.name }} · {{ u.role }} <button type="button" (click)="auth.logout()">Log out</button></span>
    }
  </div></header>
  <main><router-outlet /></main>`,
})
export class App { auth = inject(AuthService); }
