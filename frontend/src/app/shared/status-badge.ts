import { Component, input } from '@angular/core';

// Text label plus an icon, so status is never conveyed by colour alone.
@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="'badge ' + cls()">{{ icon() }} {{ status() }}</span>`,
})
export class StatusBadge {
  status = input.required<string>();
  cls() { return this.status().split(' ')[0]; }
  icon() {
    return ({ Draft: '✎', Submitted: '➤', 'Under Review': '⏳', Selected: '✔', Rejected: '✖' } as Record<string, string>)[this.status()] ?? '';
  }
}
