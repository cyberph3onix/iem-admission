export type Role = 'applicant' | 'admin';
export interface User { _id: string; name: string; email: string; role: Role; contactNumber?: string; }
export interface Course { _id: string; courseName: string; description?: string; }
export interface DocumentType { key: string; label: string; required: boolean; }
export interface DocumentMeta {
  _id: string; documentType: string; originalName: string; mimeType: string; size: number;
  validationStatus: 'Accepted' | 'Rejected'; validationMessage?: string; uploadedAt: string;
}
export interface Checklist { missingFields: string[]; missingDocuments: string[]; complete: boolean; }
export interface Fee { _id: string; amount: number; currency: string; paymentReference: string; status: string; recordedAt: string; }
export interface Verification { verified: boolean; remarks?: string; at?: string; }
export interface Application {
  _id: string; fullName: string; dateOfBirth: string; gender: string; guardianName: string; address: string;
  previousInstitution: string; status: string; submittedAt?: string; createdAt: string;
  course: Course | string; applicant?: { name: string; email: string; contactNumber?: string };
  documents: DocumentMeta[]; nextStatuses: string[]; checklist?: Checklist;
  statusHistory: { status: string; at: string }[];
  fee?: Fee | null; verification?: Verification;
}
export interface Dashboard {
  total: number; byStatus: { status: string; count: number }[];
  byCourse: { courseId: string; courseName?: string; count: number }[];
}
// Mirrors the backend's constants so statuses are not scattered as bare strings.
export const STATUS = { DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', SELECTED: 'Selected', REJECTED: 'Rejected' } as const;
export const ALL_STATUSES = Object.values(STATUS);
