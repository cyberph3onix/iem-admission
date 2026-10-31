const h = require('./helpers');
beforeAll(h.connect); beforeEach(h.reset);
afterAll(() => require('mongoose').disconnect());

test('empty database returns valid empty dashboard', async () => {
  const admin = await h.makeAdmin();
  const res = await h.request(h.app).get('/api/admin/dashboard').set(h.auth(admin));
  expect(res.status).toBe(200); expect(res.body.data).toEqual({ total: 0, byStatus: [], byCourse: [] });
  expect((await h.request(h.app).get('/api/admin/applications').set(h.auth(admin))).body.data.applications).toEqual([]);
});
test('dashboard counts, list filters, search and document download', async () => {
  const c1 = await h.makeCourse('Alpha'); const c2 = await h.makeCourse('Beta'); const admin = await h.makeAdmin();
  const ids = [];
  for (const [i, c] of [c1, c1, c2].entries()) {
    const u = await h.register(`u${i}@t.com`); await h.completeApplication(u.token, c);
    ids.push((await h.request(h.app).post('/api/applications/me/submit').set(h.auth(u.token))).body.data.application._id);
  }
  const draftUser = await h.register('draft@t.com');
  await h.request(h.app).post('/api/applications').set(h.auth(draftUser.token)).send(h.validForm(c2)); // stays Draft
  await h.request(h.app).patch(`/api/admin/applications/${ids[0]}/status`).set(h.auth(admin)).send({ status: 'Under Review' });

  const dash = (await h.request(h.app).get('/api/admin/dashboard').set(h.auth(admin))).body.data;
  expect(dash.total).toBe(3);
  expect(dash.byStatus).toEqual([{ status: 'Submitted', count: 2 }, { status: 'Under Review', count: 1 }]);
  expect(dash.byCourse.map((r) => [r.courseName, r.count])).toEqual([['Alpha', 2], ['Beta', 1]]);

  const list = (q) => h.request(h.app).get('/api/admin/applications').query(q).set(h.auth(admin));
  expect((await list({})).body.data.applications.length).toBe(3);
  expect((await list({ status: 'Submitted' })).body.data.applications.length).toBe(2);
  expect((await list({ course: String(c2._id) })).body.data.applications.length).toBe(1);
  expect((await list({ q: ids[2] })).body.data.applications.length).toBe(1);
  expect((await list({ q: 'test user' })).body.data.applications.length).toBe(3);
  expect((await list({ status: 'Bogus' })).status).toBe(400);

  const detail = await h.request(h.app).get(`/api/admin/applications/${ids[0]}`).set(h.auth(admin));
  expect(detail.body.data.application.documents.length).toBe(2);
  expect(detail.body.data.application.nextStatuses).toEqual(['Selected', 'Rejected']);
  const docId = detail.body.data.application.documents[0]._id;
  expect((await h.request(h.app).get(`/api/admin/documents/${docId}/file`).set(h.auth(admin))).status).toBe(200);
  expect((await h.request(h.app).get(`/api/admin/documents/${docId}/file`).set(h.auth(draftUser.token))).status).toBe(403);
});
