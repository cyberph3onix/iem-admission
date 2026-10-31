const h = require('./helpers');
beforeAll(h.connect); beforeEach(h.reset);
afterAll(() => require('mongoose').disconnect());
const postFee = (token, body) => h.request(h.app).post('/api/applications/me/fee').set(h.auth(token)).send(body);

test('fee record: needs application, validated, one per application, visible to applicant and admin', async () => {
  const course = await h.makeCourse(); const { token } = await h.register(); const admin = await h.makeAdmin();
  expect((await postFee(token, { paymentReference: 'TXN1' })).status).toBe(404);          // no application yet
  await h.completeApplication(token, course);
  expect((await postFee(token, {})).status).toBe(400);
  expect((await h.request(h.app).get('/api/applications/me/fee').set(h.auth(token))).status).toBe(404);
  const ok = await postFee(token, { paymentReference: 'TXN1' });
  expect(ok.status).toBe(201); expect(ok.body.data.fee.amount).toBe(500); expect(ok.body.data.fee.status).toBe('Paid');
  expect((await postFee(token, { paymentReference: 'TXN2' })).status).toBe(409);
  expect((await h.request(h.app).get('/api/applications/me/fee').set(h.auth(token))).body.data.fee.paymentReference).toBe('TXN1');
  const mine = await h.request(h.app).get('/api/applications/me').set(h.auth(token));
  expect(mine.body.data.application.fee.paymentReference).toBe('TXN1');
  const id = (await h.request(h.app).post('/api/applications/me/submit').set(h.auth(token))).body.data.application._id;
  const seen = await h.request(h.app).get(`/api/admin/applications/${id}`).set(h.auth(admin));
  expect(seen.body.data.application.fee.amount).toBe(500);
  expect((await postFee(admin, { paymentReference: 'X' })).status).toBe(403);             // admins cannot record fees
});
