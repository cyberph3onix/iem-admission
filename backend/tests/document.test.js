const h = require('./helpers');
const Document = require('../src/models/Document');
beforeAll(h.connect); beforeEach(h.reset);
afterAll(() => require('mongoose').disconnect());
const setup = async (email) => { const course = await h.makeCourse('C' + email); const u = await h.register(email);
  await h.request(h.app).post('/api/applications').set(h.auth(u.token)).send(h.validForm(course)); return u; };

test('valid file accepted: bytes stored in MongoDB, never exposed in JSON', async () => {
  const { token } = await setup('a@t.com');
  const res = await h.upload(token, 'identity_proof', h.PDF, '../../evil name.pdf');
  expect(res.status).toBe(201);
  expect(res.body.data.document.data).toBeUndefined();
  const doc = await Document.findOne().select('+data');
  expect(doc.data.equals(h.PDF)).toBe(true);
  expect(doc.originalName).toBe('evil name.pdf'); // path parts stripped
  expect(doc.size).toBe(h.PDF.length);
  expect((await Document.findOne()).data).toBeUndefined(); // not loaded by default
  const listed = await h.request(h.app).get('/api/applications/me/documents').set(h.auth(token));
  expect(listed.body.data.documents[0].data).toBeUndefined();
});
test('unsupported, spoofed, empty and oversized files are rejected and not stored', async () => {
  const { token } = await setup('a@t.com');
  for (const [buf, name] of [
    [Buffer.from('hello text'), 'a.txt'],
    [Buffer.from('MZ not a pdf'), 'fake.pdf'],
    [Buffer.alloc(0), 'empty.pdf'],
    [Buffer.concat([h.PDF, Buffer.alloc(20000)]), 'big.pdf'],
  ]) {
    const res = await h.upload(token, 'identity_proof', buf, name);
    expect(res.status).toBe(400); expect(res.body.message).toBeTruthy();
  }
  expect(await Document.countDocuments()).toBe(0);
});
test('re-upload replaces the old file; unknown type rejected', async () => {
  const { token } = await setup('a@t.com');
  await h.upload(token, 'identity_proof', h.PDF); await h.upload(token, 'identity_proof', h.PNG, 'x.png');
  expect(await Document.countDocuments()).toBe(1);
  expect((await Document.findOne().select('+data')).data.equals(h.PNG)).toBe(true);
  expect((await h.upload(token, 'bogus', h.PDF)).status).toBe(400);
});
test("applicant cannot access another applicant's document; owner gets the bytes", async () => {
  const a = await setup('a@t.com'); const b = await setup('b@t.com');
  const up = await h.upload(a.token, 'identity_proof', h.PDF);
  const id = up.body.data.document._id;
  const own = await h.request(h.app).get(`/api/applications/me/documents/${id}/file`).set(h.auth(a.token));
  expect(own.status).toBe(200); expect(own.headers['content-type']).toMatch(/application\/pdf/);
  expect((await h.request(h.app).get(`/api/applications/me/documents/${id}/file`).set(h.auth(b.token))).status).toBe(404);
  expect((await h.request(h.app).get('/api/applications/me/documents').set(h.auth(b.token))).body.data.documents).toEqual([]);
});
