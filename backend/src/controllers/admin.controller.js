const mongoose = require('mongoose');
const Application = require('../models/Application');
const Document = require('../models/Document');
const { STATUS, DOCUMENT_TYPES } = require('../config/constants');
const { canAdminTransition } = require('../services/statusWorkflow');
const { present } = require('./application.controller');

const isId = (v) => mongoose.isValidObjectId(v) && /^[0-9a-f]{24}$/i.test(String(v));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.list = async (req, res) => {
  const { status, course, q } = req.query;
  const filter = { status: { $ne: STATUS.DRAFT } }; // admins review submitted work only
  if (status) {
    if (!Object.values(STATUS).includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status filter.' });
    }
    filter.status = status;
  }
  if (course) {
    if (!isId(course)) return res.status(400).json({ success: false, message: 'Invalid course filter.' });
    filter.course = course;
  }
  if (q && typeof q === 'string') {
    filter.$or = [{ fullName: { $regex: escapeRe(q.trim()), $options: 'i' } }];
    if (isId(q.trim())) filter.$or.push({ _id: q.trim() });
  }
  const applications = await Application.find(filter)
    .populate('course', 'courseName')
    .populate('applicant', 'name email')
    .sort('-submittedAt');
  res.json({ success: true, data: { applications } });
};

exports.get = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  const app = await Application.findById(req.params.id).populate('course').populate('applicant', 'name email contactNumber');
  if (!app || app.status === STATUS.DRAFT) return res.status(404).json({ success: false, message: 'Application not found.' });
  res.json({ success: true, data: { application: await present(app) } });
};

exports.changeStatus = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  const next = req.body && req.body.status;
  if (!Object.values(STATUS).includes(next)) {
    return res.status(400).json({ success: false, message: 'A valid status is required.' });
  }
  const app = await Application.findById(req.params.id);
  if (!app || app.status === STATUS.DRAFT) return res.status(404).json({ success: false, message: 'Application not found.' });
  if (next === STATUS.SELECTED && !(app.verification && app.verification.verified)) {
    return res.status(409).json({ success: false, message: 'Verify the application before selecting it.' });
  }
  if (!canAdminTransition(app.status, next)) {
    return res.status(409).json({ success: false, message: `Cannot change status from "${app.status}" to "${next}".` });
  }
  // Guard on the current status so two concurrent admins cannot both apply a stale transition.
  const updated = await Application.findOneAndUpdate(
    { _id: app._id, status: app.status },
    { $set: { status: next }, $push: { statusHistory: { status: next, at: new Date(), by: req.user._id } } },
    { returnDocument: 'after' }
  ).populate('course');
  if (!updated) return res.status(409).json({ success: false, message: 'Status changed meanwhile; reload and retry.' });
  res.json({ success: true, data: { application: await present(updated) } });
};

// SRS "Verify Application": admin records the verification decision after inspecting data and documents.
exports.verify = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  const { verified, remarks } = req.body || {};
  if (typeof verified !== 'boolean') return res.status(400).json({ success: false, message: '"verified" (true/false) is required.' });
  if (remarks != null && (typeof remarks !== 'string' || remarks.length > 300)) {
    return res.status(400).json({ success: false, message: 'Remarks must be text up to 300 characters.' });
  }
  const app = await Application.findById(req.params.id);
  if (!app || app.status === STATUS.DRAFT) return res.status(404).json({ success: false, message: 'Application not found.' });
  if (app.status !== STATUS.SUBMITTED && app.status !== STATUS.UNDER_REVIEW) {
    return res.status(409).json({ success: false, message: `Cannot change verification once the application is "${app.status}".` });
  }
  if (verified) {
    const docs = await Document.find({ application: app._id, validationStatus: 'Accepted' }).distinct('documentType');
    const missing = DOCUMENT_TYPES.filter((t) => t.required && !docs.includes(t.key));
    if (missing.length) return res.status(409).json({ success: false, message: 'Required documents are missing or not accepted.' });
  }
  app.verification = { verified, remarks: remarks ? remarks.trim() : undefined, by: req.user._id, at: new Date() };
  await app.save();
  await app.populate('course');
  res.json({ success: true, data: { application: await present(app) } });
};

exports.dashboard = async (_req, res) => {
  // $group works like SQL GROUP BY: one output row per distinct key, with a count.
  const byStatus = await Application.aggregate([
    { $match: { status: { $ne: STATUS.DRAFT } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
    { $sort: { status: 1 } },
  ]);
  const byCourse = await Application.aggregate([
    { $match: { status: { $ne: STATUS.DRAFT } } },
    { $group: { _id: '$course', count: { $sum: 1 } } },
    { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } }, // only to show names
    { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, courseId: '$_id', courseName: '$course.courseName', count: 1 } },
    { $sort: { courseName: 1 } },
  ]);
  const total = byStatus.reduce((s, r) => s + r.count, 0);
  res.json({ success: true, data: { total, byStatus, byCourse } });
};
