const Application = require('../models/Application');
const Document = require('../models/Document');
const Fee = require('../models/Fee');
const { STATUS, DOCUMENT_TYPES } = require('../config/constants');
const { nextAdminStatuses } = require('../services/statusWorkflow');
const { validateInput, formCompleteness, PERSONAL } = require('../services/applicationValidation');

const POPULATE = ['course', 'coursePreference2', 'coursePreference3'];

const validationFailed = (res, errors) => res.status(400).json({ success: false, message: 'Validation failed.', errors });
const apply = (app, { set, unset }) => {
  app.set(set);
  for (const k of unset) app.set(k, undefined);
};
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
  const { missingFields, invalidFields } = await formCompleteness(app.toObject());
  const accepted = await Document.find({ application: app._id, validationStatus: 'Accepted' }).distinct('documentType');
  const missingDocuments = DOCUMENT_TYPES.filter((t) => t.required && !accepted.includes(t.key)).map((t) => t.key);
  return { missingFields, invalidFields, missingDocuments, complete: !missingFields.length && !invalidFields.length && !missingDocuments.length };
}
exports.completeness = completeness;
exports.POPULATE = POPULATE;

exports.create = async (req, res) => {
  if (await Application.exists({ applicant: req.user._id })) {
    return res.status(409).json({ success: false, message: 'You already have an application (one per applicant).' });
  }
  // A Draft starts with valid personal information (Section A); other sections can be saved later.
  const result = await validateInput(req.body);
  PERSONAL.forEach((f) => { if (result.set[f] === undefined) result.errors[f] ??= 'This field is required.'; });
  if (Object.keys(result.errors).length) return validationFailed(res, result.errors);
  const app = await Application.create({
    ...result.set,
    applicant: req.user._id,
    status: STATUS.DRAFT,
    statusHistory: [{ status: STATUS.DRAFT, by: req.user._id }],
  });
  await app.populate(POPULATE);
  res.status(201).json({ success: true, data: { application: await present(app) } });
};

exports.getMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id }).populate(POPULATE);
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
  const result = await validateInput(req.body, app.toObject());
  if (Object.keys(result.errors).length) return validationFailed(res, result.errors);
  apply(app, result);
  await app.save();
  await app.populate(POPULATE);
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
  ).populate(POPULATE);
  if (!updated) return res.status(409).json({ success: false, message: 'Application was already submitted.' });
  res.json({ success: true, data: { application: await present(updated) } });
};
