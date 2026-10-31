const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    courseName: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
