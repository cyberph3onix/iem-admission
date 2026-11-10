const mongoose = require('mongoose');
const { STATUS, GENDERS, CATEGORIES, ENTRANCE_EXAMS } = require('../config/constants');

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
    // Field rules live in services/applicationValidation.js. Draft applications may be partial, so the
    // schema does not mark form fields required; submission checks completeness on the server.
    // Section A - personal information
    fullName: { type: String, trim: true, maxlength: 100 },
    dateOfBirth: Date,
    gender: { type: String, enum: GENDERS },
    guardianName: { type: String, trim: true, maxlength: 100 },
    category: { type: String, enum: CATEGORIES },
    state: String,
    address: { type: String, trim: true, maxlength: 300 },
    previousInstitution: { type: String, trim: true, maxlength: 150 }, // legacy field (pre-expansion records)
    // Section B - Class 10
    class10Board: String,
    class10School: { type: String, trim: true },
    class10PassingYear: Number,
    class10TotalMarks: Number,
    class10MarksObtained: Number,
    class10Percentage: Number, // derived on the server, never entered by the applicant
    // Section C - Class 12 (PCM are subject marks out of 100; obtained/total is the separate overall aggregate)
    class12Board: String,
    class12School: { type: String, trim: true },
    class12PassingYear: Number,
    class12Stream: String,
    class12Physics: Number,
    class12Chemistry: Number,
    class12Mathematics: Number,
    class12TotalMarks: Number,
    class12MarksObtained: Number,
    class12Percentage: Number,
    // Section D - one primary entrance examination; only the selected exam's result field is kept
    entranceExam: { type: String, enum: ENTRANCE_EXAMS },
    entranceExamYear: Number,
    entranceRollNumber: { type: String, trim: true },
    jeeMainPercentile: Number,
    wbjeeRank: Number,
    iemjeeResult: { type: String, trim: true },
    // Section E - session and course preferences ("course" is the first preference, kept for compatibility)
    admissionSession: String,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    coursePreference2: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    coursePreference3: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
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
