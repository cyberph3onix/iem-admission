import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService, errorText } from '../../core/api.service';
import { ALL_STATUSES, Application, Course, Dashboard } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StatusBadge],
  template: `
  <div class="container">
    <h1>Administrator review</h1>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    <section class="card" aria-labelledby="dash-h">
      <h2 id="dash-h">Dashboard (MongoDB aggregation)</h2>
      @if (dash(); as d) {
        @if (d.total === 0) { <p class="muted">No submitted applications yet.</p> } @else {
          <p>Total submitted: <b>{{ d.total }}</b></p>
          <div class="stats" aria-label="Applications by status">
            @for (s of d.byStatus; track s.status) { <div class="stat"><app-status-badge [status]="s.status" /><b>{{ s.count }}</b></div> }
          </div>
          <h3>By course</h3>
          <div class="stats" aria-label="Applications by course">
            @for (c of d.byCourse; track c.courseId) { <div class="stat">{{ c.courseName ?? 'Unknown course' }}<b>{{ c.count }}</b></div> }
          </div>
        }
      }
    </section>

    <section class="card" aria-labelledby="list-h">
      <h2 id="list-h">Applications</h2>
      <form [formGroup]="filters" class="grid" (submit)="$event.preventDefault()">
        <div><label for="q">Search by name or application ID</label><input id="q" formControlName="q" /></div>
        <div><label for="st">Status</label><select id="st" formControlName="status"><option value="">All</option>
          @for (s of statuses; track s) { <option>{{ s }}</option> }</select></div>
        <div><label for="co">Course</label><select id="co" formControlName="course"><option value="">All</option>
          @for (c of courses(); track c._id) { <option [value]="c._id">{{ c.courseName }}</option> }</select></div>
      </form>
      @if (loading()) { <p>Loading…</p> }
      @else if (apps().length === 0) { <p class="muted">No applications match.</p> }
      @else {
        <div class="table-wrap"><table>
          <caption class="muted" style="text-align:left">{{ apps().length }} application(s)</caption>
          <thead><tr><th>ID</th><th>Applicant</th><th>Course</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
          <tbody>@for (a of apps(); track a._id) {
            <tr><td>{{ a._id.slice(-6) }}</td><td>{{ a.fullName }}<br /><span class="muted">{{ a.applicant?.email }}</span></td>
              <td>{{ courseName(a) }}</td><td>{{ a.submittedAt | date: 'mediumDate' }}</td>
              <td><app-status-badge [status]="a.status" /></td>
              <td><a [routerLink]="['/admin/applications', a._id]">Review</a></td></tr> }</tbody>
        </table></div>
      }
    </section>
  </div>`,
})
export class AdminReview implements OnInit {
  private api = inject(ApiService); private fb = inject(FormBuilder);
  statuses = ALL_STATUSES.filter((s) => s !== 'Draft');
  filters = this.fb.nonNullable.group({ q: [''], status: [''], course: [''] });
  apps = signal<Application[]>([]); courses = signal<Course[]>([]); dash = signal<Dashboard | null>(null);
  loading = signal(true); error = signal('');

  ngOnInit() {
    this.api.courses().subscribe((c) => this.courses.set(c));
    this.api.dashboard().subscribe({ next: (d) => this.dash.set(d), error: (e) => this.error.set(errorText(e).message) });
    this.filters.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
    this.load();
  }
  load() {
    this.loading.set(true);
    this.api.adminList(this.filters.getRawValue()).subscribe({
      next: (a) => { this.apps.set(a); this.loading.set(false); },
      error: (e) => { this.error.set(errorText(e).message); this.loading.set(false); },
    });
  }
  courseName(a: Application) { return typeof a.course === 'object' ? a.course.courseName : ''; }
}
