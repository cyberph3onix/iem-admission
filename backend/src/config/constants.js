// Single source of truth for statuses, roles, document categories and form options.
// Everything below is a SAMPLE POC rule set - NOT official IEM/UEM admission policy.
const ROLES = { APPLICANT: 'applicant', ADMIN: 'admin' };

const STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review', // the brief's "Review" stage
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

// All five categories are required for this POC (Section F of the form spec).
const DOCUMENT_TYPES = [
  { key: 'class10_marksheet', label: 'Class 10 Marksheet', required: true },
  { key: 'class12_marksheet', label: 'Class 12 Marksheet', required: true },
  { key: 'entrance_scorecard', label: 'Entrance Examination Scorecard', required: true },
  { key: 'identity_proof', label: 'Identity Proof', required: true },
  { key: 'photograph', label: 'Passport Photograph', required: true },
];

// Sample POC value - NOT the official IEM fee.
const APPLICATION_FEE = { amount: 500, currency: 'INR' };

const GENDERS = ['Male', 'Female', 'Other'];
// POC data field only: no reservation or eligibility decisions are made from it.
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
const CLASS10_BOARDS = ['CBSE', 'ICSE', 'WBBSE', 'Other'];
const CLASS12_BOARDS = ['CBSE', 'ISC', 'WBCHSE', 'Other'];
const ENTRANCE_EXAMS = ['JEE Main', 'WBJEE', 'IEMJEE'];
// Which result field belongs to which exam; only that one is shown, stored and required.
const EXAM_RESULT_FIELD = { 'JEE Main': 'jeeMainPercentile', WBJEE: 'wbjeeRank', IEMJEE: 'iemjeeResult' };
const MIN_YEAR = 1950;

// Admission sessions: ADMISSION_SESSIONS env var (comma separated) if set, otherwise the current and
// next academic year computed from today's date, so no year is hard-coded and goes stale.
function admissionSessions(now = new Date()) {
  const fromEnv = (process.env.ADMISSION_SESSIONS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const y = now.getFullYear();
  return [`${y}-${y + 1}`, `${y + 1}-${y + 2}`];
}

module.exports = {
  ROLES, STATUS, DOCUMENT_TYPES, APPLICATION_FEE, GENDERS, CATEGORIES, INDIAN_STATES, CLASS10_BOARDS,
  CLASS12_BOARDS, ENTRANCE_EXAMS, EXAM_RESULT_FIELD, MIN_YEAR, admissionSessions,
};
