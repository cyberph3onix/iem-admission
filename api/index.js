// Vercel serverless entry: runs the Express app as a function and connects to MongoDB on first use.
let ready;

async function init() {
  const config = require('../backend/src/config');
  const { connectDatabase } = require('../backend/src/config/database');
  await connectDatabase(config.mongoUri);
  // Idempotent: creates sample courses and the admin (from ADMIN_EMAIL / ADMIN_PASSWORD) if missing.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) await require('../backend/src/seed').seed();
}

module.exports = async (req, res) => {
  try {
    ready ??= init();
    await ready;
  } catch (err) {
    ready = undefined; // retry on the next request
    console.error('Startup failed:', err.message);
    return res.status(500).json({ success: false, message: 'Server is not configured correctly.' });
  }
  return require('../backend/src/app')(req, res);
};
