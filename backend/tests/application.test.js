const h = require('./helpers');
beforeAll(h.connect); beforeEach(h.reset); afterAll(() => require('mongoose').disconnect());

test('create/get own application; duplicate rejected; invalid fields rejected', async () => {
  const course = await h.makeCourse(); const { token } = await h.register();
  const bad = await h.request(h.app).post('/api/applications').set(h.auth(token)).send({ fullName: 'x' });
  expect(bad.status).toBe(400); expect(bad.body.errors.course).toBeTruthy();
  const ok = await h.request(h.app).post('/api/applications').set(h.auth(token)).send(h.validForm(course));
  expect(ok.status).toBe(201); expect(ok.body.data.application.status).toBe('Draft');
  const dup = await h.request(h.app).post('/api/applications').set(h.auth(token)).send(h.validForm(course));
  expect(dup.status).toBe(409);
  const mine = await h.request(h.app).get('/api/applications/me').set(h.auth(token));
  expect(mine.body.data.application.fullName).toBe('Test User');
  expect(mine.body.data.application.checklist.complete).toBe(false);
});
test('applicants only see their own application; status cannot be edited', async () => {
  const course = await h.makeCourse(); const a = await h.register('a@t.com'); const b = await h.register('b@t.com');
  await h.request(h.app).post('/api/applications').set(h.auth(a.token)).send(h.validForm(course));
  expect((await h.request(h.app).get('/api/applications/me').set(h.auth(b.token))).status).toBe(404);
  expect((await h.request(h.app).patch('/api/applications/me').set(h.auth(b.token)).send({ fullName: 'Hack' })).status).toBe(404);
  const res = await h.request(h.app).patch('/api/applications/me').set(h.auth(a.token)).send({ status: 'Selected', fullName: 'New Name' });
  expect(res.body.data.application.status).toBe('Draft');
  expect(res.body.data.application.fullName).toBe('New Name');
  const empty = await h.request(h.app).patch('/api/applications/me').set(h.auth(a.token)).send({ fullName: ' ' });
  expect(empty.status).toBe(400);
});
