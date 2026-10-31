const Application = require('../models/Application');
const Fee = require('../models/Fee');
const { APPLICATION_FEE } = require('../config/constants');

// Applicant records their application fee (simulated; no gateway).
exports.create = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  if (!app) return res.status(404).json({ success: false, message: 'Create your application first.' });
  const ref = req.body && req.body.paymentReference;
  if (typeof ref !== 'string' || !ref.trim()) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors: { paymentReference: 'Payment reference is required.' } });
  }
  if (await Fee.exists({ application: app._id })) {
    return res.status(409).json({ success: false, message: 'Fee already recorded for this application.' });
  }
  const fee = await Fee.create({ application: app._id, amount: APPLICATION_FEE.amount, currency: APPLICATION_FEE.currency, paymentReference: ref });
  res.status(201).json({ success: true, data: { fee } });
};

exports.getMine = async (req, res) => {
  const app = await Application.findOne({ applicant: req.user._id });
  const fee = app ? await Fee.findOne({ application: app._id }) : null;
  if (!fee) return res.status(404).json({ success: false, message: 'No fee recorded yet.' });
  res.json({ success: true, data: { fee } });
};
