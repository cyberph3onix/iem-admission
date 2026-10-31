const multer = require('multer');

function notFound(_req, res) {
  res.status(404).json({ success: false, message: 'Route not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large.' : `Upload error: ${err.message}`;
    return res.status(400).json({ success: false, message });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate value.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON.' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
}
module.exports = { notFound, errorHandler };
