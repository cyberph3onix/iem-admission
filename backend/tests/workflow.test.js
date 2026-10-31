const h = require('./helpers');
beforeAll(h.connect); beforeEach(h.reset);
afterAll(() => require('mongoose').disconnect());
const status = (id, token, s) => h.request(h.app).patch(`/api/admin/applications/${id}/status`).set(h.auth(token)).send({ status: s });

const verify = (id, token, verified, remarks) => h.request(h.app).patch(`/api/admin/applications/${id}/verification`).set(h.auth(token)).send({ verified, remarks });

test('incomplete draft cannot be submitted and stays Draft', async () => {
  const course = await h.makeCourse(); const { token } = await h.register();
  await h.request(h.app).post('/api/applications').set(h.auth(token)).send(h.validForm(course));
  const res = await h.request(h.app).post('/api/applications/me/submit').set(h.auth(token));
  expect(res.status).toBe(400); expect(res.body.errors.missingDocuments.length).toBe(2);
  expect((await h.request(h.app).get('/api/applications/me').set(h.auth(token))).body.data.application.status).toBe('Draft');
});
test('full lifecycle with allowed and invalid transitions', async () => {
  const course = await h.makeCourse(); const { token } = await h.register(); const admin = await h.makeAdmin();
  await h.completeApplication(token, course);
  const sub = await h.request(h.app).post('/api/applications/me/submit').set(h.auth(token));
  expect(sub.status).toBe(200); expect(sub.body.data.application.status).toBe('Submitted');
  expect((await h.request(h.app).post('/api/applications/me/submit').set(h.auth(token))).status).toBe(409);
  expect((await h.request(h.app).patch('/api/applications/me').set(h.auth(token)).send({ fullName: 'x' })).status).toBe(409);
  expect((await h.upload(token, 'photograph', h.PDF)).status).toBe(409);
  const id = sub.body.data.application._id;
  expect((await status(id, admin, 'Selected')).status).toBe(409);   // skip review
  expect((await status(id, admin, 'Draft')).status).toBe(409);
  expect((await status(id, admin, 'Nonsense')).status).toBe(400);
  expect((await status(id, token, 'Under Review')).status).toBe(403); // applicant
  expect((await status(id, admin, 'Under Review')).body.data.application.nextStatuses).toEqual(['Selected', 'Rejected']);
  expect((await status(id, admin, 'Selected')).status).toBe(409);   // not verified yet
  expect((await verify(id, token, true)).status).toBe(403);         // applicant cannot verify
  expect((await verify(id, admin, 'yes')).status).toBe(400);
  const v = await verify(id, admin, true, 'Documents match');
  expect(v.status).toBe(200); expect(v.body.data.application.verification.verified).toBe(true);
  expect((await status(id, admin, 'Selected')).body.data.application.status).toBe('Selected');
  expect((await verify(id, admin, false)).status).toBe(409);        // final status locks verification
  expect((await status(id, admin, 'Rejected')).status).toBe(409);   // final
  const mine = await h.request(h.app).get('/api/applications/me').set(h.auth(token));
  expect(mine.body.data.application.status).toBe('Selected');
  expect(mine.body.data.application.statusHistory.map((s) => s.status)).toEqual(['Draft', 'Submitted', 'Under Review', 'Selected']);
  expect((await status('bad-id', admin, 'Under Review')).status).toBe(400);
});
test('under review can be rejected', async () => {
  const course = await h.makeCourse(); const { token } = await h.register(); const admin = await h.makeAdmin();
  await h.completeApplication(token, course);
  const id = (await h.request(h.app).post('/api/applications/me/submit').set(h.auth(token))).body.data.application._id;
  await status(id, admin, 'Under Review');
  expect((await status(id, admin, 'Rejected')).body.data.application.status).toBe('Rejected');
});
