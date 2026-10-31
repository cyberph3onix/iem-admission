const Course = require('../models/Course');

exports.list = async (_req, res) => {
  const courses = await Course.find({ isActive: true }).sort('courseName');
  res.json({ success: true, data: { courses } });
};
