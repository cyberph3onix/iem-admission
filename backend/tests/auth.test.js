const h = require('./helpers');
const User = require('../src/models/User');
beforeAll(h.connect); beforeEach(h.reset); afterAll(() => require('mongoose').disconnect());

test('register, hash password, never return it, force applicant role', async () => {
  const res = await h.request(h.app).post('/api/auth/register')
    .send({ name: 'X', email: 'X@Test.com', password: 'password123', role: 'admin' });
  expect(res.status).toBe(201);
  expect(res.body.data.user.role).toBe('applicant');
  expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password123/);
  const stored = await User.findOne({ email: 'x@test.com' });
  expect(stored.passwordHash).not.toBe('password123');
  expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
});
test('login works, wrong password fails', async () => {
  await h.register('l@test.com');
  const ok = await h.request(h.app).post('/api/auth/login').send({ email: 'l@test.com', password: 'password123' });
  expect(ok.status).toBe(200); expect(ok.body.data.token).toBeTruthy();
  const bad = await h.request(h.app).post('/api/auth/login').send({ email: 'l@test.com', password: 'nope' });
  expect(bad.status).toBe(401);
});
test('invalid registration rejected; duplicate email 409', async () => {
  const bad = await h.request(h.app).post('/api/auth/register').send({ name: '', email: 'x', password: '1' });
  expect(bad.status).toBe(400);
  await h.register('d@test.com');
  const dup = await h.request(h.app).post('/api/auth/register').send({ name: 'N', email: 'd@test.com', password: 'password123' });
  expect(dup.status).toBe(409);
});
test('protected routes reject missing/invalid JWT; applicants get 403 on admin', async () => {
  expect((await h.request(h.app).get('/api/auth/me')).status).toBe(401);
  expect((await h.request(h.app).get('/api/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
  const { token } = await h.register();
  expect((await h.request(h.app).get('/api/admin/dashboard').set(h.auth(token))).status).toBe(403);
  expect((await h.request(h.app).get('/api/auth/me').set(h.auth(token))).body.data.user.email).toBe('a@test.com');
});
