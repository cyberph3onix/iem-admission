// Server-side validation for the applicant form (Sections A-E of the POC form spec).
// The Angular form mirrors these rules for user experience only; this module is the authority.
const Course = require('../models/Course');
const C = require('../config/constants');

const NAME_RE = /^[A-Za-z ]+$/;
const INT_RE = /^-?\d+$/;
const PERCENTILE_RE = /^\d+(\.\d{1,2})?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v));
const blank = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

// --- field-level checks: each returns { value } (normalised) or { error } -------------------------
const text = (min, max, { lettersOnly = false } = {}) => (v) => {
  if (typeof v !== 'string' || !v.trim()) return { error: 'This field is required.' };
  const s = v.trim();
  if (s.length < min || s.length > max) return { error: `Must be ${min}-${max} characters.` };
  if (lettersOnly && !NAME_RE.test(s)) return { error: 'Use letters and spaces only.' };
  return { value: s };
};
const oneOf = (list) => (v) => (typeof v === 'string' && list().includes(v) ? { value: v } : { error: 'Select one of the listed options.' });
const toInt = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v === 'string' && INT_RE.test(v.trim())) return Number(v.trim());
  return NaN;
};
const int = (min, max, msg) => (v) => {
  const n = toInt(v);
  const hi = typeof max === 'function' ? max() : max;
  if (Number.isNaN(n) || n < min || (hi !== undefined && n > hi)) return { error: msg };
  return { value: n };
};
const year = () => int(C.MIN_YEAR, () => new Date().getFullYear(), `Enter a year from ${C.MIN_YEAR} to ${new Date().getFullYear()}.`);
const subjectMark = int(0, 100, 'Enter a whole number from 0 to 100.');
const totalMarks = int(1, undefined, 'Enter a whole number greater than 0.');
const marksObtained = int(0, undefined, 'Enter a whole number from 0 up to the total marks.');

function dateOfBirth(v) {
  const m = typeof v === 'string' && DATE_RE.exec(v.slice(0, 10));
  if (!m) return { error: 'Enter a valid date of birth.' };
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Round-trip check rejects impossible dates such as 2005-02-30.
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    return { error: 'Enter a valid date of birth.' };
  }
  const today = new Date();
  if (d >= new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))) {
    return { error: 'Date of birth must be earlier than today.' };
  }
  return { value: d };
}
function percentile(v) {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!PERCENTILE_RE.test(s) || Number(s) > 100) return { error: 'Enter a percentile from 0 to 100 (up to 2 decimal places).' };
  return { value: Number(s) };
}
function rollNumber(v) {
  // Kept as a string so leading zeroes survive.
  if (typeof v !== 'string' || !v.trim()) return { error: 'This field is required.' };
  const s = v.trim();
  return s.length > 30 ? { error: 'Must be at most 30 characters.' } : { value: s };
}
const courseRef = (v) => (isId(v) ? { value: String(v) } : { error: 'Select a valid, active course.' });

// --- the form definition -----------------------------------------------------------------------
// required: true = needed to submit; 'exam' = needed only for the selected exam; false = optional.
const FIELDS = {
  // Section A - personal information (email / mobile come from the account, not the form)
  fullName: { label: 'Full name', required: true, check: text(2, 60, { lettersOnly: true }) },
  dateOfBirth: { label: 'Date of birth', required: true, check: dateOfBirth },
  gender: { label: 'Gender', required: true, check: oneOf(() => C.GENDERS) },
  guardianName: { label: 'Guardian name', required: true, check: text(2, 60, { lettersOnly: true }) },
  category: { label: 'Category', required: true, check: oneOf(() => C.CATEGORIES) },
  state: { label: 'State', required: true, check: oneOf(() => C.INDIAN_STATES) },
  address: { label: 'Address', required: true, check: text(5, 250) },
  // Section B - Class 10
  class10Board: { label: 'Class 10 board', required: true, check: oneOf(() => C.CLASS10_BOARDS) },
  class10School: { label: 'Class 10 school name', required: true, check: text(2, 100) },
  class10PassingYear: { label: 'Class 10 passing year', required: true, check: year() },
  class10TotalMarks: { label: 'Class 10 total marks', required: true, check: totalMarks },
  class10MarksObtained: { label: 'Class 10 marks obtained', required: true, check: marksObtained },
  // Section C - Class 12
  class12Board: { label: 'Class 12 board', required: true, check: oneOf(() => C.CLASS12_BOARDS) },
  class12School: { label: 'Class 12 school name', required: true, check: text(2, 100) },
  class12PassingYear: { label: 'Class 12 passing year', required: true, check: year() },
  class12Physics: { label: 'Physics marks', required: true, check: subjectMark },
  class12Chemistry: { label: 'Chemistry marks', required: true, check: subjectMark },
  class12Mathematics: { label: 'Mathematics marks', required: true, check: subjectMark },
  class12TotalMarks: { label: 'Class 12 total marks', required: true, check: totalMarks },
  class12MarksObtained: { label: 'Class 12 marks obtained', required: true, check: marksObtained },
  // Section D - one primary entrance examination
  entranceExam: { label: 'Entrance exam', required: true, check: oneOf(() => C.ENTRANCE_EXAMS) },
  entranceExamYear: { label: 'Entrance exam year', required: true, check: year() },
  entranceRollNumber: { label: 'Application / roll number', required: true, check: rollNumber },
  jeeMainPercentile: { label: 'JEE Main percentile', required: 'exam', check: percentile },
  wbjeeRank: { label: 'WBJEE rank', required: 'exam', check: int(1, undefined, 'Enter a rank: a whole number greater than 0.') },
  iemjeeResult: { label: 'IEMJEE result', required: 'exam', check: text(1, 30) },
  // Section E - admission session and course preferences
  admissionSession: { label: 'Admission session', required: true, check: oneOf(() => C.admissionSessions()) },
  course: { label: 'First course preference', required: true, check: courseRef },
  coursePreference2: { label: 'Second course preference', required: false, check: courseRef },
  coursePreference3: { label: 'Third course preference', required: false, check: courseRef },
};
const EDITABLE = Object.keys(FIELDS);
const PERSONAL = ['fullName', 'dateOfBirth', 'gender', 'guardianName', 'category', 'state', 'address'];
const RESULT_FIELDS = Object.values(C.EXAM_RESULT_FIELD);
const COURSE_FIELDS = ['course', 'coursePreference2', 'coursePreference3'];

const pct = (obtained, total) =>
  Number.isInteger(obtained) && Number.isInteger(total) && total > 0 && obtained <= total
    ? Math.round((obtained / total) * 10000) / 100
    : undefined;

// Cross-field rules evaluated on the merged (stored + incoming) values.
async function crossChecks(merged, errors, keys) {
  for (const p of ['class10', 'class12']) {
    const o = merged[`${p}MarksObtained`]; const t = merged[`${p}TotalMarks`];
    if (Number.isInteger(o) && Number.isInteger(t) && o > t) {
      errors[`${p}MarksObtained`] ??= 'Marks obtained cannot exceed total marks.';
    }
  }
  const [c1, c2, c3] = COURSE_FIELDS.map((k) => (merged[k] ? String(merged[k]) : ''));
  if (c2 && c2 === c1) errors.coursePreference2 ??= 'Must differ from the first preference.';
  if (c3 && (c3 === c1 || c3 === c2)) errors.coursePreference3 ??= 'Must differ from the first and second preferences.';
  const toCheck = COURSE_FIELDS.filter((k) => keys.includes(k) && merged[k] && !errors[k]);
  if (toCheck.length) {
    const active = (await Course.find({ _id: { $in: toCheck.map((k) => merged[k]) }, isActive: true }).distinct('_id')).map(String);
    for (const k of toCheck) if (!active.includes(String(merged[k]))) errors[k] = 'Select a valid, active course.';
  }
}

/**
 * Validates an incoming create/update body against the stored values.
 * Returns { set, unset, errors }; status and other non-form keys are ignored.
 */
async function validateInput(body, stored = {}) {
  const set = {}; const unset = []; const errors = {};
  const keys = EDITABLE.filter((k) => body && body[k] !== undefined);
  for (const k of keys) {
    const f = FIELDS[k]; const v = body[k];
    if (f.required !== true && blank(v)) { unset.push(k); continue; } // optional/exam fields can be cleared
    const r = f.check(v);
    if (r.error) errors[k] = r.error; else set[k] = r.value;
  }
  const merged = { ...stored, ...set };
  unset.forEach((k) => delete merged[k]);

  // Only the result field of the selected exam is kept; other exams' result values are dropped.
  for (const k of RESULT_FIELDS) {
    if (C.EXAM_RESULT_FIELD[merged.entranceExam] !== k) {
      delete set[k]; delete errors[k]; delete merged[k];
      if (stored[k] !== undefined && !unset.includes(k)) unset.push(k);
    }
  }
  await crossChecks(merged, errors, keys);
  // Percentages are always derived on the server; any client-sent percentage is ignored.
  for (const p of ['class10', 'class12']) {
    const v = pct(merged[`${p}MarksObtained`], merged[`${p}TotalMarks`]);
    if (v === undefined) { if (stored[`${p}Percentage`] !== undefined) unset.push(`${p}Percentage`); } else set[`${p}Percentage`] = v;
  }
  return { set, unset, errors };
}

/** What is still missing or invalid before an application may be submitted. */
async function formCompleteness(stored) {
  const missingFields = []; const invalidFields = [];
  const resultField = C.EXAM_RESULT_FIELD[stored.entranceExam];
  for (const [k, f] of Object.entries(FIELDS)) {
    const needed = f.required === true || (f.required === 'exam' && k === resultField);
    if (blank(stored[k])) { if (needed) missingFields.push(k); continue; }
    let v = stored[k];
    if (v instanceof Date) v = v.toISOString().slice(0, 10);
    else if (COURSE_FIELDS.includes(k)) v = String(v._id ?? v);
    if (FIELDS[k].check(v).error) invalidFields.push(k);
  }
  const plain = { ...stored };
  COURSE_FIELDS.forEach((k) => { if (plain[k]) plain[k] = String(plain[k]._id ?? plain[k]); });
  const errors = {};
  await crossChecks(plain, errors, COURSE_FIELDS.filter((k) => plain[k]));
  for (const k of Object.keys(errors)) if (!invalidFields.includes(k)) invalidFields.push(k);
  return { missingFields, invalidFields };
}

const fieldLabels = () => Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.label]));

module.exports = { validateInput, formCompleteness, fieldLabels, EDITABLE, PERSONAL, COURSE_FIELDS };
