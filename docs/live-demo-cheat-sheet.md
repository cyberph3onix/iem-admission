# Live Demo Cheat Sheet — tracing "Submit application"

**Setup:** MongoDB up, `npm run seed`, backend on :3000, frontend on :4200. Admin account from `.env`.

## Demo script (5 min)
1. Register an applicant (Register page) → lands on dashboard.
2. Pick a course, fill the form, *Create application* (Draft).
3. Upload Identity Proof + Academic Marksheet (try a `.txt` renamed `.pdf` → rejected, server checks file signature).
4. Submit button enables once the checklist is complete → status *Submitted*.
5. Log out; log in as admin → dashboard counts, filter by status/course, open application, *Mark as Under Review*, then *Selected*. Try an invalid jump (API: Submitted→Selected gives 409).
6. Log in as the applicant again → sees *Selected*.

## One request, end to end: `POST /api/applications/me/submit`
1. **Angular component** `ApplicantDashboard.submit()` (`features/applicant/applicant-dashboard.ts`) calls `ApiService.submit()`.
2. **HttpClient + interceptor** (`core/auth.interceptor.ts`) adds `Authorization: Bearer <JWT>`; request goes over HTTP to `localhost:3000` (CORS allows `:4200`).
3. **Express** `app.js`: `cors` → `express.json` → `routes/index.js` matches `POST /applications/me/submit`.
4. **Middleware**: `authenticate` verifies the JWT and loads the user from MongoDB; `authorizeRole('applicant')` checks the role (401/403 otherwise).
5. **Controller** `application.controller.js#submit`: `Application.findOne({applicant: req.user._id})` (ownership comes from the token, never the browser) → status must be Draft → `completeness()` checks required fields and accepted required documents (400 if not).
6. **Mongoose → MongoDB**: one atomic `findOneAndUpdate({_id, status:'Draft'}, {$set:{status:'Submitted'}, $push:{statusHistory}})` — a failure changes nothing.
7. **Response**: `{success:true, data:{application}}` as JSON.
8. **Angular**: `subscribe` next → shows success message, `load()` refetches, signals update, the page re-renders with the *Submitted* badge and read-only form.

## Questions to be ready for
- *Where is the file stored?* Disk, random name; Mongo has only metadata (`models/Document.js`).
- *How is an applicant stopped from reading another's data?* Every query is scoped by `req.user._id`; others' documents → 404.
- *Why can't an admin skip Review?* `services/statusWorkflow.js` transition map; 409.
- *GROUP BY equivalent?* `$group` in `admin.controller.js#dashboard`.
- *Logout limitation?* Only clears client token; JWT valid until expiry.
