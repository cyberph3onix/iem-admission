const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');

fs.mkdirSync(config.uploadDir, { recursive: true });

// Random server-side name; the original filename is never used in a path.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    cb(null, config.uploadDir);
  },
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
});

module.exports = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
}).single('file');
