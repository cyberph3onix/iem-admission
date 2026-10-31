import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { Application, DocumentMeta } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  imports: [RouterLink, DatePipe, StatusBadge],
  template: `
  <div class="container">
    <p><a routerLink="/admin">← Back to applications</a></p>
    @if (message()) { <div class="alert success" role="status">{{ message() }}</div> }
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    @if (app(); as a) {
      <section class="card">
        <h1>{{ a.fullName }} <app-status-badge [status]="a.status" /></h1>
        <dl class="grid">
          <div><dt class="muted">Application ID</dt><dd>{{ a._id }}</dd></div>
          <div><dt class="muted">Applicant account</dt><dd>{{ a.applicant?.name }} ({{ a.applicant?.email }})</dd></div>
          <div><dt class="muted">Course</dt><dd>{{ courseName() }}</dd></div>
          <div><dt class="muted">Date of birth</dt><dd>{{ a.dateOfBirth | date: 'mediumDate' }}</dd></div>
          <div><dt class="muted">Gender</dt><dd>{{ a.gender }}</dd></div>
          <div><dt class="muted">Guardian</dt><dd>{{ a.guardianName }}</dd></div>
          <div><dt class="muted">Previous institution</dt><dd>{{ a.previousInstitution }}</dd></div>
          <div><dt class="muted">Address</dt><dd>{{ a.address }}</dd></div>
        </dl>
      </section>
      <section class="card">
        <h2>Documents</h2>
        @if (a.documents.length === 0) { <p class="muted">No documents.</p> }
        <ul>@for (d of a.documents; track d._id) {
          <li>{{ d.documentType }} — {{ d.originalName }} ({{ d.mimeType }}, {{ d.size }} bytes, {{ d.validationStatus }})
            <button type="button" class="secondary" (click)="view(d)">View</button></li> }</ul>
      </section>
      <section class="card">
        <h2>Application fee</h2>
        @if (a.fee; as f) { <p>{{ f.status }}: {{ f.currency }} {{ f.amount }} — reference {{ f.paymentReference }}</p> }
        @else { <p class="muted">No fee recorded.</p> }
      </section>
      <section class="card">
        <h2>Verification</h2>
        <p>Status: <strong>{{ a.verification?.verified ? 'Verified' : 'Not verified' }}</strong>
          @if (a.verification?.remarks) { <span class="muted"> — {{ a.verification?.remarks }}</span> }</p>
        @if (a.status === 'Submitted' || a.status === 'Under Review') {
          <div class="field"><label for="remarks">Remarks (optional)</label>
            <input id="remarks" type="text" maxlength="300" [value]="remarks()" (input)="remarks.set($any($event.target).value)" /></div>
          <div class="row">
            <button type="button" [disabled]="busy()" (click)="verify(true)">Mark as verified</button>
            <button type="button" class="secondary" [disabled]="busy()" (click)="verify(false)">Mark as not verified</button>
          </div>
        } @else { <p class="muted">Verification is locked once the application is {{ a.status }}.</p> }
      </section>
      <section class="card">
        <h2>Change status</h2>
        <p class="muted">History: @for (h of a.statusHistory; track $index) { {{ h.status }} ({{ h.at | date: 'short' }}){{ $last ? '' : ' → ' }} }</p>
        @if (a.nextStatuses.length === 0) { <p>No further transitions are allowed from "{{ a.status }}".</p> }
        <div class="row">@for (s of a.nextStatuses; track s) {
          <button type="button" [class.danger]="s === 'Rejected'" [disabled]="busy()" (click)="move(s)">Mark as {{ s }}</button> }</div>
      </section>
    } @else if (!error()) { <p>Loading…</p> }
  </div>`,
})
export class AdminDetail implements OnInit {
  id = input.required<string>(); // bound from the route param
  private api = inject(ApiService);
  app = signal<Application | null>(null); error = signal(''); message = signal(''); busy = signal(false); remarks = signal('');
  ngOnInit() {
    this.api.adminGet(this.id()).subscribe({ next: (a) => this.app.set(a), error: (e) => this.error.set(errorText(e).message) });
  }
  courseName() { const c = this.app()?.course; return typeof c === 'object' ? c.courseName : ''; }
  view(d: DocumentMeta) { this.api.openFile(`/admin/documents/${d._id}/file`); }
  verify(verified: boolean) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.adminVerify(this.id(), verified, this.remarks().trim() || undefined).subscribe({
      next: (a) => { this.app.set({ ...this.app()!, ...a, applicant: this.app()!.applicant, course: this.app()!.course }); this.message.set(verified ? 'Application marked as verified.' : 'Application marked as not verified.'); this.busy.set(false); },
      error: (e) => { this.error.set(errorText(e).message); this.busy.set(false); },
    });
  }
  move(status: string) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.adminSetStatus(this.id(), status).subscribe({
      next: (a) => { this.app.set({ ...this.app()!, ...a, applicant: this.app()!.applicant, course: this.app()!.course }); this.message.set(`Status changed to ${status}.`); this.busy.set(false); },
      error: (e) => { this.error.set(errorText(e).message); this.busy.set(false); },
    });
  }
}
