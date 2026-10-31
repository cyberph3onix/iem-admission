import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_URL } from './auth.service';
import { Application, Course, Fee, Dashboard, DocumentMeta, DocumentType } from './models';

interface Res<T> { success: boolean; data: T; }

/** Turns an HttpErrorResponse into a readable message (plus per-field errors). */
export function errorText(err: unknown): { message: string; errors: Record<string, string> } {
  const e = err as HttpErrorResponse;
  const body = e?.error;
  if (!body || typeof body !== 'object') return { message: 'Cannot reach the server. Is the backend running?', errors: {} };
  return { message: body.message || 'Something went wrong.', errors: body.errors && !Array.isArray(body.errors) ? body.errors : {} };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private get<T>(url: string, params?: HttpParams) { return this.http.get<Res<T>>(`${API_URL}${url}`, { params }).pipe(map((r) => r.data)); }

  courses() { return this.get<{ courses: Course[] }>('/courses').pipe(map((d) => d.courses)); }
  documentTypes() { return this.get<{ documentTypes: DocumentType[] }>('/document-types').pipe(map((d) => d.documentTypes)); }

  myApplication() { return this.get<{ application: Application }>('/applications/me').pipe(map((d) => d.application)); }
  createApplication(body: unknown) {
    return this.http.post<Res<{ application: Application }>>(`${API_URL}/applications`, body).pipe(map((r) => r.data.application));
  }
  updateApplication(body: unknown) {
    return this.http.patch<Res<{ application: Application }>>(`${API_URL}/applications/me`, body).pipe(map((r) => r.data.application));
  }
  submit() {
    return this.http.post<Res<{ application: Application }>>(`${API_URL}/applications/me/submit`, {}).pipe(map((r) => r.data.application));
  }
  recordFee(paymentReference: string) {
    return this.http.post<Res<{ fee: Fee }>>(`${API_URL}/applications/me/fee`, { paymentReference }).pipe(map((r) => r.data.fee));
  }
  uploadDocument(documentType: string, file: File) {
    const form = new FormData();
    form.append('documentType', documentType); // text field first so the server sees it with the file
    form.append('file', file);
    return this.http.post<Res<{ document: DocumentMeta }>>(`${API_URL}/applications/me/documents`, form).pipe(map((r) => r.data.document));
  }
  /** Files need the Authorization header, so we fetch a Blob and open it instead of using a plain link. */
  openFile(path: string) {
    this.http.get(`${API_URL}${path}`, { responseType: 'blob' }).subscribe((blob) => {
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    });
  }

  adminList(filters: { status?: string; course?: string; q?: string }) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v) params = params.set(k, v);
    return this.get<{ applications: Application[] }>('/admin/applications', params).pipe(map((d) => d.applications));
  }
  adminGet(id: string) { return this.get<{ application: Application }>(`/admin/applications/${id}`).pipe(map((d) => d.application)); }
  adminSetStatus(id: string, status: string) {
    return this.http.patch<Res<{ application: Application }>>(`${API_URL}/admin/applications/${id}/status`, { status }).pipe(map((r) => r.data.application));
  }
  adminVerify(id: string, verified: boolean, remarks?: string) {
    return this.http.patch<Res<{ application: Application }>>(`${API_URL}/admin/applications/${id}/verification`, { verified, remarks }).pipe(map((r) => r.data.application));
  }
  dashboard() { return this.get<Dashboard>('/admin/dashboard'); }
}
