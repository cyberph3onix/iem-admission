const Application = require('../models/Application');
const Course = require('../models/Course');
const Document = require('../models/Document');
const Fee = require('../models/Fee');
const { STATUS, DOCUMENT_TYPES } = require('../config/constants');
const { nextAdminStatuses } = require('../services/statusWorkflow');

const EDITABLE = ['course', 'fullName', 'dateOfBirth', 'gender', 'guardianName', 'address', 'previousInstitution'];

function pickEditable(body) {
  const out = {};
  for (const k of EDITABLE) if (body && body[k] !== undefined) out[k] = body[k];
  return out; // status, applicant, etc. are silently ignored
}

async function checkCourseAndDob(fields) {
  const errors = {};
  if (fields.course !== undefined) {
    const ok = /^[0-9a-f]{24}$/i.test(String(fields.course)) && (await Course.exists({ _id: fields.course, isActive: true }));
    if (!ok) errors.course = 'Select a valid, active course.';
  }
  if (fields.dateOfBirth !== undefined) {
    const d = new Date(fields.dateOfBirth);
    if (Number.isNaN(d.getTime()) || d > new Date()) errors.dateOfBirth = 'Enter a valid date of birth in the past.';
  }
  return errors;
}

const present = async (app) => {
  const docs = await Document.find({ application: app._id });
  const o = app.toJSON();
  o.documents = docs;
  o.fee = await Fee.findOne({ application: app._id });
  o.nextStatuses = nextAdminStatuses(app.status);
  return o;
};
exports.present = present;

// Returns the missing pieces needed for submission (used by UI checklist and by submit).
async function completeness(app) {
  const doc = app.toObject();
  const missingFields = EDITABLE.filter((f) => !doc[f]);
  const accepted = await Document.find({ application: app._id, validationStatus: 'Accepted' }).distinct('documentType');
  const missingDocuments = DOCUMENT_TYPES.filter((t) => t.required && !accepted.includes(t.key)).map((t) => t.key);
  return { missingFields, missingDocuments, complete: !missingFields.length && !missingDocuments.length };
}
exports.completeness = completeness;

exports.create = async (req, res) => {
  if (await Application.exists({ applicant: req.user._id })) {
    return res.status(409).json({ success: false, message: 'You already have an application (one per applicant).' });
  }
  const fields = pickEditable(req.body);
  const missing = EDITABLE.filter((f) => !fields[f]);
  const errors = { ...(await checkCourseAndDob(fields)) };
  missing.forEach((f) => (errors[f] ??= 'This field is required.'));
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  const app = await Application.create({
    ...fields,
    applicant: req.user._id,
    status: STATUS.DRAFT,
    statusHistory: [{ status: STATUS.DRAFT, by: req.user._id }],
  });
  res.status(201).json({ success: true, data: { application: await present(app) } });
};

exports.getMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id }).populate('course');
  if (!app) return res.status(404).json({ success: false, message: 'No application yet.' });
  const data = await present(app);
  data.checklist = await completeness(app);
  res.json({ success: true, data: { application: data } });
};

exports.updateMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  if (!app) return res.status(404).json({ success: false, message: 'No application yet.' });
  if (app.status !== STATUS.DRAFT) {
    return res.status(409).json({ success: false, message: 'Only a Draft application can be edited.' });
  }
  const fields = pickEditable(req.body);
  const errors = await checkCourseAndDob(fields);
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' && !v.trim()) errors[k] = 'This field cannot be empty.';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  app.set(fields);
  await app.save();
  await app.populate('course');
  res.json({ success: true, data: { application: await present(app) } });
};

exports.submit = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  if (!app) return res.status(404).json({ success: false, message: 'No application yet.' });
  if (app.status !== STATUS.DRAFT) {
    return res.status(409).json({ success: false, message: 'Application was already submitted.' });
  }
  const check = await completeness(app);
  if (!check.complete) {
    return res.status(400).json({ success: false, message: 'Application is incomplete.', errors: check });
  }
  // Single atomic write guarded by the current status: failure changes nothing.
  const updated = await Application.findOneAndUpdate(
    { _id: app._id, status: STATUS.DRAFT },
    {
      $set: { status: STATUS.SUBMITTED, submittedAt: new Date() },
      $push: { statusHistory: { status: STATUS.SUBMITTED, at: new Date(), by: req.user._id } },
    },
    { returnDocument: 'after' }
  ).populate('course');
  if (!updated) return res.status(409).json({ success: false, message: 'Application was already submitted.' });
  res.json({ success: true, data: { application: await present(updated) } });
};
