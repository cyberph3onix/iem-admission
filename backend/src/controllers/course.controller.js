const Course = require('../models/Course');

exports.list = async (_req, res) => {
  const courses = await Course.find({ isActive: true }).sort('courseName');
  res.json({ success: true, data: { courses } });
};

// Dropdown options for the applicant form, served from the backend constants so both sides agree.
const C = require('../config/constants');
const { fieldLabels } = require('../services/applicationValidation');
exports.formOptions = (_req, res) => {
  res.json({
    success: true,
    data: {
      genders: C.GENDERS, categories: C.CATEGORIES, states: C.INDIAN_STATES,
      class10Boards: C.CLASS10_BOARDS, class12Boards: C.CLASS12_BOARDS,
      entranceExams: C.ENTRANCE_EXAMS, examResultField: C.EXAM_RESULT_FIELD,
      admissionSessions: C.admissionSessions(), minYear: C.MIN_YEAR, currentYear: new Date().getFullYear(),
      fieldLabels: fieldLabels(),
    },
  });
};
