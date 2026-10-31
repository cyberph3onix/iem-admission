const multer = require('multer');
const config = require('../config');

// Files are kept in memory, validated, then stored in MongoDB (serverless hosts have no persistent disk).
// The original filename is display-only and never used as a path.
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
}).single('file');
