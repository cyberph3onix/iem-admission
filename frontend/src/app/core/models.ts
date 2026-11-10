export type Role = 'applicant' | 'admin';
export interface User { _id: string; name: string; email: string; role: Role; contactNumber?: string; }
export interface Course { _id: string; courseName: string; description?: string; }
export interface DocumentType { key: string; label: string; required: boolean; }
export interface DocumentMeta {
  _id: string; documentType: string; originalName: string; mimeType: string; size: number;
  validationStatus: 'Accepted' | 'Rejected'; validationMessage?: string; uploadedAt: string;
}
export interface Checklist { missingFields: string[]; invalidFields?: string[]; missingDocuments: string[]; complete: boolean; }
export interface Fee { _id: string; amount: number; currency: string; paymentReference: string; status: string; recordedAt: string; }
export interface Verification { verified: boolean; remarks?: string; at?: string; }
export interface Application {
  _id: string; status: string; submittedAt?: string; createdAt: string;
  // Section A
  fullName: string; dateOfBirth: string; gender: string; guardianName: string; category?: string; state?: string; address: string;
  previousInstitution?: string; // legacy records only
  // Section B
  class10Board?: string; class10School?: string; class10PassingYear?: number; class10TotalMarks?: number;
  class10MarksObtained?: number; class10Percentage?: number;
  // Section C
  class12Board?: string; class12School?: string; class12PassingYear?: number; class12Stream?: string;
  class12Physics?: number; class12Chemistry?: number; class12Mathematics?: number;
  class12TotalMarks?: number; class12MarksObtained?: number; class12Percentage?: number;
  // Section D
  entranceExam?: string; entranceExamYear?: number; entranceRollNumber?: string;
  jeeMainPercentile?: number; wbjeeRank?: number; iemjeeResult?: string;
  // Section E
  admissionSession?: string; course?: Course | string; coursePreference2?: Course | string; coursePreference3?: Course | string;
  applicant?: { name: string; email: string; contactNumber?: string };
  documents: DocumentMeta[]; nextStatuses: string[]; checklist?: Checklist;
  statusHistory: { status: string; at: string }[];
  fee?: Fee | null; verification?: Verification;
}
export interface FormOptions {
  genders: string[]; categories: string[]; states: string[]; class10Boards: string[]; class12Boards: string[];
  streams: string[]; entranceExams: string[]; examResultField: Record<string, string>; admissionSessions: string[];
  minYear: number; currentYear: number; fieldLabels: Record<string, string>;
}
export const courseName = (c: Course | string | undefined | null) => (c && typeof c === 'object' ? c.courseName : '');
export const courseId = (c: Course | string | undefined | null) => (c && typeof c === 'object' ? c._id : c || '');
export interface Dashboard {
  total: number; byStatus: { status: string; count: number }[];
  byCourse: { courseId: string; courseName?: string; count: number }[];
}
// Mirrors the backend's constants so statuses are not scattered as bare strings.
export const STATUS = { DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', SELECTED: 'Selected', REJECTED: 'Rejected' } as const;
export const ALL_STATUSES = Object.values(STATUS);
