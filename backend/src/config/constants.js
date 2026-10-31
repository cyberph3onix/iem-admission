// Single source of truth for statuses, roles and document categories.
const ROLES = { APPLICANT: 'applicant', ADMIN: 'admin' };

const STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review', // the brief's "Review" stage
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

// Sample POC document categories - NOT official IEM policy.
const DOCUMENT_TYPES = [
  { key: 'identity_proof', label: 'Identity Proof', required: true },
  { key: 'academic_marksheet', label: 'Academic Marksheet', required: true },
  { key: 'photograph', label: 'Passport Photograph', required: false },
];

// Sample POC value - NOT the official IEM fee.
const APPLICATION_FEE = { amount: 500, currency: 'INR' };

module.exports = { ROLES, STATUS, DOCUMENT_TYPES, APPLICATION_FEE };
