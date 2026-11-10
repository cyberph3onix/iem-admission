import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { Application, DocumentMeta, DocumentType, courseName } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  imports: [RouterLink, DatePipe, StatusBadge],
  providers: [DecimalPipe],
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
          <div><dt class="muted">Mobile (account)</dt><dd>{{ a.applicant?.contactNumber || '—' }}</dd></div>
        </dl>
      </section>
      @for (sec of sections(a); track sec.title) {
        <section class="card">
          <h2>{{ sec.title }}</h2>
          <dl class="grid">@for (r of sec.rows; track r[0]) { <div><dt class="muted">{{ r[0] }}</dt><dd>{{ r[1] }}</dd></div> }</dl>
        </section>
      }
      <section class="card">
        <h2>Documents</h2>
        @if (a.documents.length === 0) { <p class="muted">No documents.</p> }
        @for (t of missingDocs(a); track t.key) { <p class="err">✖ Missing: {{ t.label }}</p> }
        <ul>@for (d of a.documents; track d._id) {
          <li><b>{{ docLabel(d.documentType) }}</b> — {{ d.originalName }} ({{ d.mimeType }}, {{ d.size }} bytes, {{ d.validationStatus }})
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
  types = signal<DocumentType[]>([]);
  private num = inject(DecimalPipe); private date = new DatePipe('en-US');
  ngOnInit() {
    this.api.documentTypes().subscribe((t) => this.types.set(t));
    this.api.adminGet(this.id()).subscribe({ next: (a) => this.app.set(a), error: (e) => this.error.set(errorText(e).message) });
  }
  docLabel(key: string) { return this.types().find((t) => t.key === key)?.label ?? key; }
  missingDocs(a: Application) { return this.types().filter((t) => t.required && !a.documents.some((d) => d.documentType === t.key)); }
  /** Read-only view of all form sections; values missing on legacy records show as a dash. */
  sections(a: Application): { title: string; rows: [string, string][] }[] {
    const v = (x: unknown) => (x === undefined || x === null || x === '' ? '—' : String(x));
    const pct = (x?: number) => (x == null ? '—' : `${this.num.transform(x, '1.0-2')}%`);
    const result = a.entranceExam === 'JEE Main' ? ['JEE Main percentile', v(a.jeeMainPercentile)]
      : a.entranceExam === 'WBJEE' ? ['WBJEE rank', v(a.wbjeeRank)]
      : a.entranceExam === 'IEMJEE' ? ['IEMJEE result', v(a.iemjeeResult)] : ['Result', '—'];
    const personal: [string, string][] = [
      ['Full name', v(a.fullName)], ['Date of birth', v(this.date.transform(a.dateOfBirth, 'mediumDate'))], ['Gender', v(a.gender)],
      ['Guardian name', v(a.guardianName)], ['Category', v(a.category)], ['State / UT', v(a.state)], ['Address', v(a.address)],
    ];
    if (a.previousInstitution) personal.push(['Previous institution (legacy)', a.previousInstitution]);
    return [
      { title: 'A. Personal information', rows: personal },
      { title: 'B. Class 10', rows: [['Board', v(a.class10Board)], ['School', v(a.class10School)], ['Passing year', v(a.class10PassingYear)],
        ['Marks', `${v(a.class10MarksObtained)} / ${v(a.class10TotalMarks)}`], ['Percentage', pct(a.class10Percentage)]] },
      { title: 'C. Class 12', rows: [['Board', v(a.class12Board)], ['School', v(a.class12School)], ['Passing year', v(a.class12PassingYear)],
        ['Physics / Chemistry / Mathematics', `${v(a.class12Physics)} / ${v(a.class12Chemistry)} / ${v(a.class12Mathematics)}`],
        ['Overall marks', `${v(a.class12MarksObtained)} / ${v(a.class12TotalMarks)}`], ['Percentage', pct(a.class12Percentage)]] },
      { title: 'D. Entrance examination', rows: [['Exam', v(a.entranceExam)], ['Year', v(a.entranceExamYear)],
        ['Application / roll number', v(a.entranceRollNumber)], result as [string, string]] },
      { title: 'E. Course preferences', rows: [['Admission session', v(a.admissionSession)], ['First preference', v(courseName(a.course))],
        ['Second preference', v(courseName(a.coursePreference2))], ['Third preference', v(courseName(a.coursePreference3))]] },
    ];
  }
  view(d: DocumentMeta) { this.api.openFile(`/admin/documents/${d._id}/file`); }
  verify(verified: boolean) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.adminVerify(this.id(), verified, this.remarks().trim() || undefined).subscribe({
      next: (a) => { this.app.set({ ...this.app()!, ...a, applicant: this.app()!.applicant }); this.message.set(verified ? 'Application marked as verified.' : 'Application marked as not verified.'); this.busy.set(false); },
      error: (e) => { this.error.set(errorText(e).message); this.busy.set(false); },
    });
  }
  move(status: string) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.adminSetStatus(this.id(), status).subscribe({
      next: (a) => { this.app.set({ ...this.app()!, ...a, applicant: this.app()!.applicant }); this.message.set(`Status changed to ${status}.`); this.busy.set(false); },
      error: (e) => { this.error.set(errorText(e).message); this.busy.set(false); },
    });
  }
}
