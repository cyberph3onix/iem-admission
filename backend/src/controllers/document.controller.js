const fs = require('fs');
const path = require('path');
const config = require('../config');
const Application = require('../models/Application');
const Document = require('../models/Document');
const { STATUS, DOCUMENT_TYPES } = require('../config/constants');
const { validateFile } = require('../services/documentValidation');

const remove = (p) => fs.promises.unlink(p).catch(() => {});

exports.listTypes = (_req, res) => res.json({ success: true, data: { documentTypes: DOCUMENT_TYPES } });

exports.upload = async (req, res) => {
  const filePath = req.file && req.file.path;
  let stored = false; // any exit without a saved record must delete the file
  try {
    const app = await Application.findOne({ applicant: req.user._id });
    if (!app) return res.status(404).json({ success: false, message: 'Create your application first.' });
    if (app.status !== STATUS.DRAFT) {
      return res.status(409).json({ success: false, message: 'Documents can only be changed while in Draft.' });
    }
    const type = DOCUMENT_TYPES.find((t) => t.key === req.body.documentType);
    if (!type) return res.status(400).json({ success: false, message: 'Unknown document type.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

    const result = validateFile(filePath, { allowedMimeTypes: config.allowedMimeTypes, maxBytes: config.maxUploadBytes });
    if (!result.ok) {
      await remove(filePath);
      return res.status(400).json({ success: false, message: result.message });
    }
    const previous = await Document.findOne({ application: app._id, documentType: type.key });
    const doc = await Document.findOneAndUpdate(
      { application: app._id, documentType: type.key },
      {
        originalName: path.basename(req.file.originalname).slice(0, 200),
        storedName: req.file.filename,
        mimeType: result.mimeType,
        size: result.size,
        validationStatus: 'Accepted',
        validationMessage: 'File type and content verified.',
        uploadedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    stored = true;
    if (previous) await remove(path.join(config.uploadDir, previous.storedName));
    res.status(201).json({ success: true, data: { document: doc } });
  } finally {
    if (filePath && !stored) await remove(filePath);
  }
};

exports.listMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  const documents = app ? await Document.find({ application: app._id }) : [];
  res.json({ success: true, data: { documents } });
};

function sendFile(res, doc) {
  const full = path.join(config.uploadDir, doc.storedName);
  if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: 'File missing.' });
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="document"`);
  fs.createReadStream(full).pipe(res);
}

// Applicant: only documents of their own application are reachable (else 404).
exports.downloadMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  const doc = app && (await Document.findOne({ _id: req.params.docId, application: app._id }));
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
  sendFile(res, doc);
};

exports.downloadAny = async (req, res) => {
  const doc = await Document.findById(req.params.docId);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
  sendFile(res, doc);
};
