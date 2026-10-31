import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorText } from '../../core/api.service';
import { Application, Course, DocumentMeta, DocumentType, STATUS } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

const FIELD_LABELS: Record<string, string> = {
  course: 'Course', fullName: 'Full name', dateOfBirth: 'Date of birth', gender: 'Gender',
  guardianName: 'Guardian name', address: 'Address', previousInstitution: 'Previous institution',
};

@Component({
  imports: [ReactiveFormsModule, DatePipe, StatusBadge],
  templateUrl: './applicant-dashboard.html',
})
export class ApplicantDashboard implements OnInit {
  private fb = inject(FormBuilder); private api = inject(ApiService);
  readonly STATUS = STATUS;
  courses = signal<Course[]>([]); types = signal<DocumentType[]>([]);
  app = signal<Application | null>(null);
  loading = signal(true); saving = signal(false); submitting = signal(false);
  message = signal(''); error = signal(''); fieldErrors = signal<Record<string, string>>({});
  feeRef = signal(''); feeBusy = signal(false); feeMsg = signal<{ ok: boolean; text: string }>({ ok: true, text: '' });
  uploading = signal<Record<string, boolean>>({}); uploadMsg = signal<Record<string, { ok: boolean; text: string }>>({});

  isDraft = computed(() => !this.app() || this.app()!.status === STATUS.DRAFT);
  courseName = computed(() => { const c = this.app()?.course; return typeof c === 'object' && c ? c.courseName : ''; });
  docOf = (key: string): DocumentMeta | undefined => this.app()?.documents.find((d) => d.documentType === key);
  missingLabels = computed(() => {
    const c = this.app()?.checklist; if (!c) return [];
    return [...c.missingFields.map((f) => FIELD_LABELS[f] ?? f),
      ...c.missingDocuments.map((k) => this.types().find((t) => t.key === k)?.label ?? k)];
  });

  form = this.fb.nonNullable.group({
    course: ['', Validators.required], fullName: ['', Validators.required], dateOfBirth: ['', Validators.required],
    gender: ['', Validators.required], guardianName: ['', Validators.required], address: ['', Validators.required],
    previousInstitution: ['', Validators.required],
  });

  ngOnInit() {
    this.api.courses().subscribe((c) => this.courses.set(c));
    this.api.documentTypes().subscribe((t) => this.types.set(t));
    this.load();
  }

  load() {
    this.api.myApplication().subscribe({
      next: (a) => { this.setApp(a); this.loading.set(false); },
      error: (e) => { this.loading.set(false); if (e.status !== 404) this.error.set(errorText(e).message); },
    });
  }
  private setApp(a: Application) {
    this.app.set(a);
    const course = typeof a.course === 'object' ? a.course._id : a.course;
    this.form.patchValue({ ...a, course, dateOfBirth: a.dateOfBirth?.slice(0, 10) });
    if (a.status !== STATUS.DRAFT) this.form.disable(); else this.form.enable();
  }
  err(f: string) {
    const c = this.form.get(f)!;
    return this.fieldErrors()[f] || (c.invalid && (c.touched || c.dirty) ? 'This field is required.' : '');
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true); this.message.set(''); this.error.set(''); this.fieldErrors.set({});
    const body = this.form.getRawValue();
    const req = this.app() ? this.api.updateApplication(body) : this.api.createApplication(body);
    req.subscribe({
      next: () => { this.message.set('Application saved.'); this.saving.set(false); this.load(); },
      error: (e) => { const r = errorText(e); this.error.set(r.message); this.fieldErrors.set(r.errors); this.saving.set(false); },
    });
  }

  upload(type: DocumentType, ev: Event) {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0];
    if (!file) return;
    this.uploading.update((u) => ({ ...u, [type.key]: true }));
    this.uploadMsg.update((m) => ({ ...m, [type.key]: { ok: true, text: '' } }));
    this.api.uploadDocument(type.key, file).subscribe({
      next: () => { this.uploading.update((u) => ({ ...u, [type.key]: false })); this.uploadMsg.update((m) => ({ ...m, [type.key]: { ok: true, text: 'Uploaded and verified.' } })); input.value = ''; this.load(); },
      error: (e) => { this.uploading.update((u) => ({ ...u, [type.key]: false })); this.uploadMsg.update((m) => ({ ...m, [type.key]: { ok: false, text: errorText(e).message } })); input.value = ''; },
    });
  }
  recordFee() {
    const ref = this.feeRef().trim();
    if (!ref) { this.feeMsg.set({ ok: false, text: 'Enter a payment reference.' }); return; }
    this.feeBusy.set(true); this.feeMsg.set({ ok: true, text: '' });
    this.api.recordFee(ref).subscribe({
      next: () => { this.feeBusy.set(false); this.feeMsg.set({ ok: true, text: 'Fee recorded.' }); this.load(); },
      error: (e) => { this.feeBusy.set(false); this.feeMsg.set({ ok: false, text: errorText(e).message }); },
    });
  }
  view(d: DocumentMeta) { this.api.openFile(`/applications/me/documents/${d._id}/file`); }

  submit() {
    this.submitting.set(true); this.message.set(''); this.error.set('');
    this.api.submit().subscribe({
      next: () => { this.message.set('Application submitted. You can track its status below.'); this.submitting.set(false); this.load(); },
      error: (e) => { this.error.set(errorText(e).message); this.submitting.set(false); },
    });
  }
}
