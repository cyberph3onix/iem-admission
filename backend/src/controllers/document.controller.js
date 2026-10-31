const path = require('path');
const config = require('../config');
const Application = require('../models/Application');
const Document = require('../models/Document');
const { STATUS, DOCUMENT_TYPES } = require('../config/constants');
const { validateFile } = require('../services/documentValidation');

exports.listTypes = (_req, res) => res.json({ success: true, data: { documentTypes: DOCUMENT_TYPES } });

exports.upload = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  if (!app) return res.status(404).json({ success: false, message: 'Create your application first.' });
  if (app.status !== STATUS.DRAFT) {
    return res.status(409).json({ success: false, message: 'Documents can only be changed while in Draft.' });
  }
  const type = DOCUMENT_TYPES.find((t) => t.key === req.body.documentType);
  if (!type) return res.status(400).json({ success: false, message: 'Unknown document type.' });
  if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

  const result = validateFile(req.file.buffer, { allowedMimeTypes: config.allowedMimeTypes, maxBytes: config.maxUploadBytes });
  if (!result.ok) return res.status(400).json({ success: false, message: result.message });

  // Upsert: re-uploading replaces the previous file for this category.
  const doc = await Document.findOneAndUpdate(
    { application: app._id, documentType: type.key },
    {
      originalName: path.basename(req.file.originalname).slice(0, 200),
      data: req.file.buffer,
      mimeType: result.mimeType,
      size: result.size,
      validationStatus: 'Accepted',
      validationMessage: 'File type and content verified.',
      uploadedAt: new Date(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, data: { document: doc } });
};

exports.listMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  const documents = app ? await Document.find({ application: app._id }) : [];
  res.json({ success: true, data: { documents } });
};

async function sendFile(res, id) {
  const doc = await Document.findById(id).select('+data');
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline; filename="document"');
  res.send(doc.data);
}

// Applicant: only documents of their own application are reachable (else 404).
exports.downloadMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  const doc = app && (await Document.findOne({ _id: req.params.docId, application: app._id }));
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
  await sendFile(res, doc._id);
};

exports.downloadAny = async (req, res) => {
  await sendFile(res, req.params.docId);
};
