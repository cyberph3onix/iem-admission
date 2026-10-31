const mongoose = require('mongoose');

// FR-12: application-fee record. A record only - no payment gateway (out of scope, SRS 8).
const feeSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentReference: { type: String, required: true, trim: true, maxlength: 60 },
    status: { type: String, enum: ['Paid'], default: 'Paid' },
  },
  { timestamps: { createdAt: 'recordedAt', updatedAt: false } }
);

feeSchema.set('toJSON', { transform: (_d, ret) => { delete ret.__v; return ret; } });
module.exports = mongoose.model('Fee', feeSchema);
