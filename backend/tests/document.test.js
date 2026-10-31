const fs = require('fs'); const path = require('path');
const h = require('./helpers');
const Document = require('../src/models/Document');
const dir = process.env.UPLOAD_DIR;
beforeAll(async () => { await h.connect(); });
beforeEach(async () => { await h.reset(); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); return require('mongoose').disconnect(); });
const setup = async (email) => { const course = await h.makeCourse('C' + email); const u = await h.register(email);
  await h.request(h.app).post('/api/applications').set(h.auth(u.token)).send(h.validForm(course)); return u; };

test('valid file accepted: stored on disk with random name; DB holds only metadata', async () => {
  const { token } = await setup('a@t.com');
  const res = await h.upload(token, 'identity_proof', h.PDF, '../../evil name.pdf');
  expect(res.status).toBe(201);
  expect(JSON.stringify(res.body)).not.toMatch(/storedName|uploads/);
  const doc = await Document.findOne();
  expect(fs.readdirSync(dir)).toEqual([doc.storedName]);
  expect(doc.storedName).toMatch(/^[0-9a-f]{32}$/);
  expect(doc.toObject().size).toBe(h.PDF.length);
  expect(Object.keys(doc.toObject())).not.toContain('data');
});
test('unsupported, spoofed, empty and oversized files rejected and cleaned up', async () => {
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
  expect(fs.readdirSync(dir)).toEqual([]);
  expect(await Document.countDocuments()).toBe(0);
});
test('re-upload replaces old file; unknown type rejected', async () => {
  const { token } = await setup('a@t.com');
  await h.upload(token, 'identity_proof', h.PDF); await h.upload(token, 'identity_proof', h.PNG, 'x.png');
  expect(fs.readdirSync(dir).length).toBe(1); expect(await Document.countDocuments()).toBe(1);
  expect((await h.upload(token, 'bogus', h.PDF)).status).toBe(400);
  expect(fs.readdirSync(dir).length).toBe(1);
});
test("applicant cannot access another applicant's document", async () => {
  const a = await setup('a@t.com'); const b = await setup('b@t.com');
  const up = await h.upload(a.token, 'identity_proof', h.PDF);
  const id = up.body.data.document._id;
  expect((await h.request(h.app).get(`/api/applications/me/documents/${id}/file`).set(h.auth(a.token))).status).toBe(200);
  expect((await h.request(h.app).get(`/api/applications/me/documents/${id}/file`).set(h.auth(b.token))).status).toBe(404);
  expect((await h.request(h.app).get('/api/applications/me/documents').set(h.auth(b.token))).body.data.documents).toEqual([]);
});
