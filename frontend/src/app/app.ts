import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `
  <header class="top"><div class="container">
    <div class="brand">
      <span class="logos">
        <img src="iem_logo.png" alt="Institute of Engineering & Management" />
        <img src="uem_logo.png" alt="University of Engineering & Management" />
      </span>
      <strong>IEM Admission System <span style="font-weight:400">(POC)</span></strong>
    </div>
    @if (auth.user(); as u) {
      <span>{{ u.name }} · {{ u.role }} <button type="button" (click)="auth.logout()">Log out</button></span>
    }
  </div></header>
  <main><router-outlet /></main>`,
})
export class App { auth = inject(AuthService); }
