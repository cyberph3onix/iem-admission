// Expanded applicant form: EP / BVA / decision-table cases from the form-expansion spec (REQ-02..REQ-08).
const h = require('./helpers');
const Course = require('../src/models/Course');
const { validateFile } = require('../src/services/documentValidation');
const { admissionSessions } = require('../src/config/constants');
beforeAll(h.connect); beforeEach(h.reset);
afterAll(() => require('mongoose').disconnect());

const create = (token, body) => h.request(h.app).post('/api/applications').set(h.auth(token)).send(body);
const patch = (token, body) => h.request(h.app).patch('/api/applications/me').set(h.auth(token)).send(body);
const mine = async (token) => (await h.request(h.app).get('/api/applications/me').set(h.auth(token))).body.data.application;
const submit = (token) => h.request(h.app).post('/api/applications/me/submit').set(h.auth(token));
async function draft() {
  const course = await h.makeCourse(); const u = await h.register();
  expect((await create(u.token, h.personal())).status).toBe(201);
  return { ...u, course };
}
const rejects = async (token, body, field) => {
  const r = await patch(token, body); expect(r.status).toBe(400); expect(r.body.errors[field]).toBeTruthy();
};
const accepts = async (token, body) => expect((await patch(token, body)).status).toBe(200);

test('REQ-02: Draft is created from valid personal information alone; personal fields are required', async () => {
  const { token } = await h.register();
  const r = await create(token, { fullName: 'Asha Roy' });
  expect(r.status).toBe(400);
  for (const f of ['dateOfBirth', 'gender', 'guardianName', 'category', 'state', 'address']) expect(r.body.errors[f]).toBeTruthy();
  const ok = await create(token, { ...h.personal(), status: 'Selected' });
  expect(ok.status).toBe(201); expect(ok.body.data.application.status).toBe('Draft');
  expect((await mine(token)).checklist.missingFields).toContain('class10Board');
});

test('BVA/EP: full name, guardian, address, date of birth, dropdowns', async () => {
  const { token } = await draft();
  await rejects(token, { fullName: 'A' }, 'fullName');             // BVA-NAME-01
  await accepts(token, { fullName: 'Ab' });                         // BVA-NAME-02
  await accepts(token, { fullName: 'A'.repeat(60) });               // BVA-NAME-03
  await rejects(token, { fullName: 'A'.repeat(61) }, 'fullName');   // BVA-NAME-04
  await rejects(token, { fullName: '   ' }, 'fullName');
  await rejects(token, { fullName: 'R2D2' }, 'fullName');
  await accepts(token, { fullName: '  Asha Roy  ' });
  expect((await mine(token)).fullName).toBe('Asha Roy');            // trimmed
  await rejects(token, { guardianName: 'X@Y' }, 'guardianName');
  await rejects(token, { address: '1234' }, 'address');
  await rejects(token, { address: 'x'.repeat(251) }, 'address');
  await rejects(token, { dateOfBirth: '2999-01-01' }, 'dateOfBirth');
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await rejects(token, { dateOfBirth: today }, 'dateOfBirth');
  await rejects(token, { dateOfBirth: '2005-02-30' }, 'dateOfBirth');
  await rejects(token, { dateOfBirth: 'yesterday' }, 'dateOfBirth');
  for (const [k, v] of [['gender', 'Unknown'], ['category', 'VIP'], ['state', 'Atlantis'], ['class10Board', 'IB']]) {
    await rejects(token, { [k]: v }, k);
  }
});

test('BVA/EP: Class 10 / Class 12 marks, years, and server-calculated percentages', async () => {
  const { token } = await draft();
  const y = new Date().getFullYear();
  await rejects(token, { class10PassingYear: 1949 }, 'class10PassingYear');
  await accepts(token, { class10PassingYear: 1950 });
  await accepts(token, { class10PassingYear: y });
  await rejects(token, { class10PassingYear: y + 1 }, 'class10PassingYear');
  await rejects(token, { class10PassingYear: '20x0' }, 'class10PassingYear');
  await rejects(token, { class10TotalMarks: 0 }, 'class10TotalMarks');
  await accepts(token, { class10TotalMarks: 500 });
  await rejects(token, { class10MarksObtained: -1 }, 'class10MarksObtained');   // BVA-MARK-01
  await accepts(token, { class10MarksObtained: 0 });                            // BVA-MARK-02
  await accepts(token, { class10MarksObtained: 500 });                          // BVA-MARK-03
  await rejects(token, { class10MarksObtained: 501 }, 'class10MarksObtained');  // BVA-MARK-04
  await rejects(token, { class10MarksObtained: 44.5 }, 'class10MarksObtained');
  await accepts(token, { class10MarksObtained: 450, class10Percentage: 12 });   // manual percentage ignored
  let a = await mine(token);
  expect(a.class10Percentage).toBe(90); expect(typeof a.class10Percentage).toBe('number');
  await rejects(token, { class10TotalMarks: 400 }, 'class10MarksObtained');     // total below stored obtained
  for (const k of ['class12Physics', 'class12Chemistry', 'class12Mathematics']) {
    await rejects(token, { [k]: -1 }, k); await accepts(token, { [k]: 0 });       // BVA-PCM-01/02
    await accepts(token, { [k]: 100 }); await rejects(token, { [k]: 101 }, k);    // BVA-PCM-03/04
    await rejects(token, { [k]: 'abc' }, k);
  }
  // PCM marks are not summed into the overall aggregate.
  await accepts(token, { class12TotalMarks: 600, class12MarksObtained: 401 });
  a = await mine(token);
  expect(a.class12Percentage).toBe(66.83);
});

test('Entrance exam: only the selected exam result field is validated, stored and required', async () => {
  const { token } = await draft();
  await accepts(token, { entranceExam: 'JEE Main', entranceExamYear: 2024, entranceRollNumber: '000045' });
  expect((await mine(token)).entranceRollNumber).toBe('000045');               // leading zeroes kept
  await rejects(token, { jeeMainPercentile: -0.01 }, 'jeeMainPercentile');      // BVA-PCT-01
  await accepts(token, { jeeMainPercentile: 0 });                               // BVA-PCT-02
  await accepts(token, { jeeMainPercentile: 100 });                             // BVA-PCT-03
  await rejects(token, { jeeMainPercentile: 100.01 }, 'jeeMainPercentile');     // BVA-PCT-04
  await rejects(token, { jeeMainPercentile: 95.123 }, 'jeeMainPercentile');
  await rejects(token, { jeeMainPercentile: '95%' }, 'jeeMainPercentile');
  await accepts(token, { jeeMainPercentile: '98.25', wbjeeRank: 'ignored' });   // other exam's field ignored
  let a = await mine(token);
  expect(a.jeeMainPercentile).toBe(98.25); expect(a.wbjeeRank).toBeUndefined();
  await accepts(token, { entranceExam: 'WBJEE' });                              // switching clears the old result
  a = await mine(token);
  expect(a.jeeMainPercentile).toBeUndefined(); expect(a.checklist.missingFields).toContain('wbjeeRank');
  await rejects(token, { wbjeeRank: 0 }, 'wbjeeRank');
  await rejects(token, { wbjeeRank: -5 }, 'wbjeeRank');
  await rejects(token, { wbjeeRank: 1.5 }, 'wbjeeRank');
  await accepts(token, { wbjeeRank: 1 });
  await accepts(token, { entranceExam: 'IEMJEE', iemjeeResult: 'Rank 12 / 99.1' });
  await rejects(token, { iemjeeResult: 'x'.repeat(31) }, 'iemjeeResult');
  await rejects(token, { entranceExam: 'GATE' }, 'entranceExam');
  await rejects(token, { entranceRollNumber: 'x'.repeat(31) }, 'entranceRollNumber');
});

test('Course preferences and admission session (REQ-06)', async () => {
  const { token, course } = await draft();
  const c2 = await h.makeCourse('Course B'); const c3 = await h.makeCourse('Course C');
  const off = await Course.create({ courseName: 'Closed', isActive: false });
  await rejects(token, { admissionSession: '1999-2000' }, 'admissionSession');
  await accepts(token, { admissionSession: admissionSessions()[1] });
  await rejects(token, { course: String(off._id) }, 'course');
  await rejects(token, { course: 'not-an-id' }, 'course');
  await accepts(token, { course: String(course._id), coursePreference2: String(c2._id), coursePreference3: String(c3._id) });
  await rejects(token, { coursePreference2: String(course._id) }, 'coursePreference2');
  await rejects(token, { coursePreference3: String(c2._id) }, 'coursePreference3');
  await accepts(token, { coursePreference3: '' });                              // optional preference cleared
  const a = await mine(token);
  expect(a.coursePreference3).toBeUndefined(); expect(a.coursePreference2.courseName).toBe('Course B');
});

test('Decision table SUB-01..SUB-05: submission needs all fields and all five documents', async () => {
  const { token, course } = await draft();
  // SUB-04: fields and documents both missing
  let r = await submit(token);
  expect(r.status).toBe(400); expect(r.body.errors.missingFields.length).toBeGreaterThan(0); expect(r.body.errors.missingDocuments.length).toBe(5);
  // SUB-03: fields complete, a document missing
  await accepts(token, h.validForm(course));
  for (const k of ['class10_marksheet', 'class12_marksheet', 'entrance_scorecard', 'identity_proof']) await h.upload(token, k, h.PDF);
  r = await submit(token);
  expect(r.status).toBe(400); expect(r.body.errors.missingFields).toEqual([]); expect(r.body.errors.missingDocuments).toEqual(['photograph']);
  // SUB-02: documents complete, a field missing (switch exam so its result field is missing)
  await h.upload(token, 'photograph', h.PNG, 'p.png');
  await accepts(token, { entranceExam: 'WBJEE' });
  r = await submit(token);
  expect(r.status).toBe(400); expect(r.body.errors.missingFields).toEqual(['wbjeeRank']); expect(r.body.errors.missingDocuments).toEqual([]);
  // SUB-01
  await accepts(token, { wbjeeRank: 1520 });
  r = await submit(token);
  expect(r.status).toBe(200); expect(r.body.data.application.status).toBe('Submitted');
  // SUB-05 + STT-11: repeat submission and edits after submission are rejected
  expect((await submit(token)).status).toBe(409);
  expect((await patch(token, { fullName: 'Changed Name' })).status).toBe(409);
  expect((await mine(token)).fullName).toBe('Test User');
});

test('Registration mobile number must be a 10-digit Indian mobile number', async () => {
  const reg = (contactNumber, email) => h.request(h.app).post('/api/auth/register').send({ name: 'M', email, password: 'password123', contactNumber });
  expect((await reg('12345', 'a@t.com')).status).toBe(400);
  expect((await reg('5123456789', 'b@t.com')).status).toBe(400);
  const ok = await reg('+91 98765 43210', 'c@t.com');
  expect(ok.status).toBe(201); expect(ok.body.data.user.contactNumber).toBe('9876543210');
});

test('BVA-FILE-01..05 at the real 2 MiB limit (2,097,152 bytes)', () => {
  const opts = { allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 };
  const pdf = (n) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n - 9)]);
  expect(validateFile(Buffer.alloc(0), opts).ok).toBe(false);          // 0 bytes
  expect(validateFile(Buffer.from('%'), opts).ok).toBe(false);         // 1 byte, not valid content
  expect(validateFile(pdf(2097151), opts).ok).toBe(true);
  expect(validateFile(pdf(2097152), opts).ok).toBe(true);              // exactly 2 MiB
  expect(validateFile(pdf(2097153), opts).ok).toBe(false);             // 2 MiB + 1 byte
});
