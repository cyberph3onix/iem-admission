const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Course = require('../src/models/Course');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);

async function connect() {
  await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/iem_admission_test');
}
async function reset() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
async function register(email = 'a@test.com') {
  const res = await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'password123' });
  return { token: res.body.data.token, user: res.body.data.user };
}
async function makeAdmin() {
  await User.create({ name: 'Admin', email: 'admin@test.com', role: 'admin', passwordHash: await bcrypt.hash('adminpass1', 4) });
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass1' });
  return res.body.data.token;
}
const makeCourse = (courseName = 'Course A') => Course.create({ courseName });
const { admissionSessions, DOCUMENT_TYPES } = require('../src/config/constants');
const personal = () => ({
  fullName: 'Test User', dateOfBirth: '2005-01-01', gender: 'Female', guardianName: 'Guardian Name',
  category: 'General', state: 'West Bengal', address: '1 Park Road, Kolkata',
});
// A complete, valid form across Sections A-E (JEE Main selected).
const validForm = (course) => ({
  ...personal(),
  class10Board: 'CBSE', class10School: 'Test School', class10PassingYear: 2020, class10TotalMarks: 500, class10MarksObtained: 450,
  class12Board: 'WBCHSE', class12School: 'Test College', class12PassingYear: 2022,
  class12Physics: 80, class12Chemistry: 75, class12Mathematics: 90, class12TotalMarks: 500, class12MarksObtained: 400,
  entranceExam: 'JEE Main', entranceExamYear: 2022, entranceRollNumber: '00123', jeeMainPercentile: 95.5,
  admissionSession: admissionSessions()[0], course: String(course._id),
});
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const upload = (token, type, buf, name = 'f.pdf') =>
  request(app).post('/api/applications/me/documents').set(auth(token)).field('documentType', type).attach('file', buf, name);

async function completeApplication(token, course) {
  await request(app).post('/api/applications').set(auth(token)).send(validForm(course));
  for (const t of DOCUMENT_TYPES) await upload(token, t.key, t.key === 'photograph' ? PNG : PDF, t.key === 'photograph' ? 'p.png' : 'f.pdf');
}
module.exports = { personal, app, request, connect, reset, register, makeAdmin, makeCourse, validForm, auth, upload, completeApplication, PDF, PNG };
