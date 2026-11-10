import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiService, errorText } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Application, Course, DocumentMeta, DocumentType, FormOptions, STATUS, courseId, courseName } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

// These validators mirror the server rules for user experience only; the backend re-validates everything.
const NAME = Validators.pattern(/^\s*[A-Za-z ]+\s*$/);
const notBlank = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.length > 0 && !c.value.trim() ? { blank: true } : null;
const trimmedLength = (min: number, max: number) => (c: AbstractControl): ValidationErrors | null => {
  const v = typeof c.value === 'string' ? c.value.trim() : '';
  return v && (v.length < min || v.length > max) ? { length: { min, max } } : null;
};
const integer = (c: AbstractControl): ValidationErrors | null =>
  c.value === null || c.value === '' || Number.isInteger(Number(c.value)) ? null : { integer: true };
const twoDecimals = (c: AbstractControl): ValidationErrors | null =>
  c.value === null || c.value === '' || /^\d+(\.\d{1,2})?$/.test(String(c.value)) ? null : { decimals: true };
const pastDate = (c: AbstractControl): ValidationErrors | null => {
  if (!c.value) return null;
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return c.value < today ? null : { future: true };
};
const RESULT_FIELDS = ['jeeMainPercentile', 'wbjeeRank', 'iemjeeResult'] as const;
const OPTIONAL_PREFS = ['coursePreference2', 'coursePreference3'];
const PERSONAL = ['fullName', 'dateOfBirth', 'gender', 'guardianName', 'category', 'state', 'address'];

@Component({
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, StatusBadge],
  templateUrl: './applicant-dashboard.html',
})
export class ApplicantDashboard implements OnInit {
  private fb = inject(FormBuilder); private api = inject(ApiService); readonly auth = inject(AuthService);
  readonly STATUS = STATUS; readonly courseName = courseName;
  courses = signal<Course[]>([]); types = signal<DocumentType[]>([]); opts = signal<FormOptions | null>(null);
  app = signal<Application | null>(null);
  loading = signal(true); saving = signal(false); submitting = signal(false);
  message = signal(''); error = signal(''); fieldErrors = signal<Record<string, string>>({});
  feeRef = signal(''); feeBusy = signal(false); feeMsg = signal<{ ok: boolean; text: string }>({ ok: true, text: '' });
  uploading = signal<Record<string, boolean>>({}); uploadMsg = signal<Record<string, { ok: boolean; text: string }>>({});
  readonly year = new Date().getFullYear();

  form = this.fb.group({
    // Section A
    fullName: ['', [Validators.required, notBlank, NAME, trimmedLength(2, 60)]],
    dateOfBirth: ['', [Validators.required, pastDate]],
    gender: ['', Validators.required],
    guardianName: ['', [Validators.required, notBlank, NAME, trimmedLength(2, 60)]],
    category: ['', Validators.required],
    state: ['', Validators.required],
    address: ['', [Validators.required, notBlank, trimmedLength(5, 250)]],
    // Section B
    class10Board: [''], class10School: ['', [notBlank, trimmedLength(2, 100)]],
    class10PassingYear: [null as number | null, [Validators.min(1950), Validators.max(this.year), integer]],
    class10TotalMarks: [null as number | null, [Validators.min(1), integer]],
    class10MarksObtained: [null as number | null, [Validators.min(0), integer]],
    // Section C
    class12Board: [''], class12School: ['', [notBlank, trimmedLength(2, 100)]],
    class12PassingYear: [null as number | null, [Validators.min(1950), Validators.max(this.year), integer]],
    class12Physics: [null as number | null, [Validators.min(0), Validators.max(100), integer]],
    class12Chemistry: [null as number | null, [Validators.min(0), Validators.max(100), integer]],
    class12Mathematics: [null as number | null, [Validators.min(0), Validators.max(100), integer]],
    class12TotalMarks: [null as number | null, [Validators.min(1), integer]],
    class12MarksObtained: [null as number | null, [Validators.min(0), integer]],
    // Section D
    entranceExam: [''],
    entranceExamYear: [null as number | null, [Validators.min(1950), Validators.max(this.year), integer]],
    entranceRollNumber: ['', [notBlank, Validators.maxLength(30)]],
    jeeMainPercentile: [null as number | null, [Validators.min(0), Validators.max(100), twoDecimals]],
    wbjeeRank: [null as number | null, [Validators.min(1), integer]],
    iemjeeResult: ['', [notBlank, Validators.maxLength(30)]],
    // Section E
    admissionSession: [''], course: [''], coursePreference2: [''], coursePreference3: [''],
  });
  // getRawValue so the read-only (disabled) form of a submitted application still shows its values.
  private values = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  isDraft = computed(() => !this.app() || this.app()!.status === STATUS.DRAFT);
  exam = computed(() => this.values().entranceExam || '');
  // Display only: the server calculates and stores the real percentage.
  pct10 = computed(() => this.percent(this.values().class10MarksObtained, this.values().class10TotalMarks));
  pct12 = computed(() => this.percent(this.values().class12MarksObtained, this.values().class12TotalMarks));
  docOf = (key: string): DocumentMeta | undefined => this.app()?.documents.find((d) => d.documentType === key);
  missingLabels = computed(() => {
    const c = this.app()?.checklist; const labels = this.opts()?.fieldLabels ?? {};
    if (!c) return [];
    return [...c.missingFields.map((f) => labels[f] ?? f),
      ...(c.invalidFields ?? []).map((f) => `${labels[f] ?? f} (invalid value)`),
      ...c.missingDocuments.map((k) => this.types().find((t) => t.key === k)?.label ?? k)];
  });

  ngOnInit() {
    this.api.courses().subscribe((c) => this.courses.set(c));
    this.api.documentTypes().subscribe((t) => this.types.set(t));
    this.api.formOptions().subscribe((o) => this.opts.set(o));
    // Changing the exam clears the other exams' result values (the backend also drops them).
    this.form.controls.entranceExam.valueChanges.pipe(distinctUntilChanged()).subscribe((exam) => {
      const keep = this.opts()?.examResultField[exam ?? ''];
      if (keep !== 'jeeMainPercentile') this.form.controls.jeeMainPercentile.reset(null);
      if (keep !== 'wbjeeRank') this.form.controls.wbjeeRank.reset(null);
      if (keep !== 'iemjeeResult') this.form.controls.iemjeeResult.reset('');
    });
    this.load();
  }

  private percent(o: number | null | undefined, t: number | null | undefined) {
    if (o == null || t == null || !Number.isInteger(+o) || !Number.isInteger(+t) || +t <= 0 || +o < 0 || +o > +t) return null;
    return Math.round((+o / +t) * 10000) / 100;
  }
  prefOptions(field: 'coursePreference2' | 'coursePreference3') {
    const v = this.values();
    const taken = field === 'coursePreference2' ? [v.course] : [v.course, v.coursePreference2];
    return this.courses().filter((c) => !taken.includes(c._id));
  }

  load() {
    this.api.myApplication().subscribe({
      next: (a) => { this.setApp(a); this.loading.set(false); },
      error: (e) => { this.loading.set(false); if (e.status !== 404) this.error.set(errorText(e).message); },
    });
  }
  private setApp(a: Application) {
    this.app.set(a);
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(this.form.controls)) {
      const v = (a as unknown as Record<string, unknown>)[k];
      patch[k] = v ?? (this.form.get(k)!.value === null ? null : '');
    }
    patch['dateOfBirth'] = a.dateOfBirth?.slice(0, 10) ?? '';
    for (const k of ['course', ...OPTIONAL_PREFS]) patch[k] = courseId((a as never)[k]);
    this.form.patchValue(patch);
    if (a.status !== STATUS.DRAFT) this.form.disable(); else this.form.enable();
  }

  err(f: string) {
    const c = this.form.get(f)!;
    if (this.fieldErrors()[f]) return this.fieldErrors()[f];
    if (!c.invalid || !(c.touched || c.dirty)) return '';
    const e = c.errors!;
    if (e['required'] || e['blank']) return 'This field is required.';
    if (e['length']) return `Must be ${e['length'].min}-${e['length'].max} characters.`;
    if (e['pattern']) return 'Use letters and spaces only.';
    if (e['future']) return 'Date of birth must be earlier than today.';
    if (e['integer']) return 'Enter a whole number.';
    if (e['decimals']) return 'Use at most 2 decimal places.';
    if (e['maxlength']) return `At most ${e['maxlength'].requiredLength} characters.`;
    if (e['min']) return `Must be at least ${e['min'].min}.`;
    if (e['max']) return `Must be at most ${e['max'].max}.`;
    return 'Invalid value.';
  }

  /** Only filled-in values are sent, so a partly completed Draft can be saved; optional preferences can be cleared. */
  private body() {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const keep = this.opts()?.examResultField[String(raw['entranceExam'] ?? '')];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if ((RESULT_FIELDS as readonly string[]).includes(k) && k !== keep) continue;
      if (OPTIONAL_PREFS.includes(k)) { if (this.app() || v) out[k] = v || ''; continue; }
      if (v === null || v === '' || v === undefined) continue;
      out[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  }

  save() {
    this.form.markAllAsTouched();
    const invalid = Object.entries(this.form.controls).filter(([, c]) => c.invalid).map(([k]) => k);
    if (invalid.length) {
      this.error.set(PERSONAL.some((k) => invalid.includes(k)) && !this.app()
        ? 'Complete Section A (personal information) to create your draft.'
        : 'Fix the highlighted fields before saving.');
      return;
    }
    this.saving.set(true); this.message.set(''); this.error.set(''); this.fieldErrors.set({});
    const body = this.body();
    const req = this.app() ? this.api.updateApplication(body) : this.api.createApplication(body);
    req.subscribe({
      next: () => { this.message.set('Draft saved.'); this.saving.set(false); this.load(); },
      error: (e) => { const r = errorText(e); this.error.set(r.message); this.fieldErrors.set(r.errors); this.saving.set(false); },
    });
  }
  clearServerError(f: string) {
    if (this.fieldErrors()[f]) this.fieldErrors.update(({ [f]: _, ...rest }) => rest);
  }

  upload(type: DocumentType, ev: Event) {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.uploadMsg.update((m) => ({ ...m, [type.key]: { ok: false, text: 'The file is larger than 2 MB.' } })); input.value = ''; return;
    }
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
      error: (e) => { this.error.set(errorText(e).message); this.submitting.set(false); this.load(); },
    });
  }
}
