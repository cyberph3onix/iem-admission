# IEM Admission System — MEAN Stack POC

A small, demonstrable proof of concept for a Software Engineering lab: applicants register, fill one admission form, upload documents and submit; an administrator reviews and moves the application through a status workflow; the applicant sees the latest status.

**Flow:** Angular form → HTTP/JSON → Express (on Node.js) → Mongoose → MongoDB → JSON response → Angular updates the page.

> All data is synthetic. Courses, document categories, and upload limits are **sample POC values, not official IEM policy**. No payment, scoring, cutoff or quota logic exists (out of scope).

## Implementation notes and assumptions
- The workspace contained only the build prompt; the SRS/HLD/wireframes were not available. Application form fields (full name, date of birth, gender, guardian, address, previous institution, course) are therefore sample fields; change them in `backend/src/models/Application.js` and the Angular form.
- The SRS describes a relational DB; the lab's MEAN brief requires **MongoDB**, so MongoDB + Mongoose is used.
- One application per applicant (unique index on `applicant`) — a POC simplification.
- Status `Under Review` represents the brief's "Review" stage. Workflow: `Draft → Submitted` (applicant, submit endpoint only) → `Under Review` → `Selected` / `Rejected` (admin). Transition map: `backend/src/services/statusWorkflow.js`.
- Auth: bcrypt hashes + JWT. The Angular app keeps the JWT in `localStorage` (simple, but readable by injected scripts; production should prefer httpOnly cookies). Logout only clears the client token — an issued JWT stays valid until expiry (no revocation).
- Ownership: all applicant routes are `/applications/me/*`, scoped by the authenticated user id from the JWT. Another applicant's document returns `404` (existence not disclosed); wrong role returns `403`; missing/invalid token `401`.
- Uploads: Multer keeps the file in memory; type is verified by file signature (magic bytes), size and non-empty checks, and rejected files are never stored. Accepted files (max 2 MB) are stored in MongoDB with their metadata, because serverless hosts have no persistent disk. Files are served only through authenticated endpoints. Limits: PDF/JPEG/PNG, 2 MB (`MAX_UPLOAD_BYTES`). Required categories: Identity Proof, Academic Marksheet (`backend/src/config/constants.js`).
- Application fee (FR-12): applicant records a fee with a payment reference (sample amount INR 500, no payment gateway). Verification (SRS "Verify Application"): an admin marks a submitted application verified/not verified with optional remarks; an application cannot be Selected until it is verified.
- Backend is plain JavaScript (CommonJS) for simplicity; frontend is TypeScript.

## Prerequisites
Node.js 20+ (built with 24), npm, and a MongoDB (local or Docker):
```bash
docker run -d --name iem-mongo -p 27017:27017 mongo:7
```

## Setup and run
```bash
cd backend
cp .env.example .env        # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run seed                # sample courses + the initial admin (safe to re-run)
npm start                   # http://localhost:3000/api/health

cd ../frontend
npm install
npm start                   # http://localhost:4200
```
Log in as the admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`. Applicants register from the UI. The API base URL for Angular is in `frontend/src/app/core/auth.service.ts` (`API_URL`).

### Environment variables (`backend/.env`)
`PORT`, `MONGODB_URI`, `MONGODB_URI_TEST`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `MAX_UPLOAD_BYTES`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Tests
```bash
cd backend && npm test      # Vitest + Supertest; needs MongoDB; uses the separate iem_admission_test database
```
16 tests cover: registration/login/hashing/role forcing, JWT and RBAC (401/403), application ownership and validation, one-per-applicant, status immutability by applicants, upload accept/reject/cleanup/ownership, submission gating, every workflow transition, dashboard aggregation (including empty), admin filters. Frontend has no automated tests (verified manually; production build passes with `npm run build`). Jest was replaced by Vitest because the MongoDB driver fails its handshake inside Jest's sandbox.

## API (all under `/api`, JSON `{success, data}` / `{success:false, message, errors?}`)
| Method | Endpoint | Access |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` | authenticated |
| GET | `/courses`, `/document-types` | authenticated |
| POST/GET/PATCH | `/applications`, `/applications/me` | applicant |
| POST | `/applications/me/submit` | applicant |
| POST/GET | `/applications/me/documents` | applicant (multipart field `file` + `documentType`) |
| GET | `/applications/me/documents/:docId/file` | applicant (own only) |
| GET | `/admin/applications?status=&course=&q=` | admin |
| GET | `/admin/applications/:id` | admin |
| PATCH | `/admin/applications/:id/status` | admin (`{status}`, 409 if invalid transition) |
| POST/GET | `/applications/me/fee` | applicant (records the application fee) |
| PATCH | `/admin/applications/:id/verification` | admin (`{verified, remarks?}`) |
| GET | `/admin/dashboard` | admin (aggregation: counts by status and course) |
| GET | `/admin/documents/:docId/file` | admin |

## Deploy to Vercel (frontend + API in one project)
1. Create a free MongoDB Atlas cluster, add a database user, allow network access from `0.0.0.0/0`, and copy the connection string.
2. On vercel.com choose **Add New → Project**, import this repo, and leave all build settings as they are (`vercel.json` configures them).
3. Add environment variables: `MONGODB_URI` (Atlas string, with a database name such as `/iem_admission`), `JWT_SECRET` (a long random string), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional: `ADMIN_NAME`.
4. Deploy. On the first API request the function creates the sample courses and the admin account, so no separate seed step is needed. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

How it works: `vercel.json` builds the Angular app and serves it statically; `/api/*` is routed to `api/index.js`, which runs the Express app as a serverless function. The deployed frontend calls `/api` on its own origin, so no CORS setup is needed.

## Structure
```
backend/src/{config,models,routes,controllers,middleware,services}, app.js, server.js, seed.js
backend/tests/
api/index.js            # Vercel serverless entry
frontend/src/app/{core,features/{auth,applicant,admin},shared}
docs/
```

## Verification status
Verified by running: backend tests (15 pass), Angular production build, browser registration → applicant dashboard, and a scripted full flow (register, create, upload, rejected bad file, submit, admin review transitions, dashboard, applicant sees final status). The remaining browser screens (file picker upload, admin screens) were not clicked through in a browser.
