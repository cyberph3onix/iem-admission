// File signatures (magic bytes) for the supported formats.
const SIGNATURES = {
  'application/pdf': (b) => b.slice(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.length >= 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

/**
 * Validate an uploaded file buffer. Returns { ok, message, mimeType, size }.
 * The MIME type is detected from the bytes, not trusted from the browser.
 */
function validateFile(buffer, { allowedMimeTypes, maxBytes }) {
  const size = buffer.length;
  if (size === 0) return { ok: false, message: 'The file is empty.' };
  if (size > maxBytes) {
    return { ok: false, message: `The file exceeds the ${Math.round(maxBytes / 1024)} KB limit.` };
  }
  const head = buffer.subarray(0, 16);
  const detected = Object.keys(SIGNATURES).find((mime) => SIGNATURES[mime](head));
  if (!detected || !allowedMimeTypes.includes(detected)) {
    return { ok: false, message: 'Unsupported or corrupt file. Allowed: PDF, JPEG, PNG.' };
  }
  return { ok: true, mimeType: detected, size };
}

module.exports = { validateFile };
