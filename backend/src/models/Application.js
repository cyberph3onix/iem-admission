const mongoose = require('mongoose');
const { STATUS } = require('../config/constants');

const historySchema = new mongoose.Schema(
  {
    status: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    // unique => one application per applicant (documented POC simplification)
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    guardianName: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    previousInstitution: { type: String, required: true, trim: true, maxlength: 150 },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT },
    submittedAt: Date,
    // Admin verification of the submitted application and its documents (SRS use case "Verify Application").
    verification: {
      verified: { type: Boolean, default: false },
      remarks: { type: String, trim: true, maxlength: 300 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    statusHistory: [historySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', applicationSchema);
