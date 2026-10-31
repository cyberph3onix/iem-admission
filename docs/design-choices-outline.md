# Design Choices — Write-up Outline (1–2 pages)
1. **Scope & goal** — thin vertical slice: register → apply → upload → submit → review → status.
2. **Why MEAN / MongoDB** — lab brief requires it; SRS's relational model reinterpreted as 4 collections (users, courses, applications, documents) with references.
3. **Layering** — Angular client → Express routes/controllers → Mongoose models → MongoDB; thin controllers, rules in `services/` (statusWorkflow, documentValidation).
4. **Authentication & RBAC** — bcrypt + JWT; `authenticate` and `authorizeRole` middleware; server is the authority, Angular guards are UX only; 401/403/404 policy; public signup can never create admins; trade-off: localStorage token, no revocation.
5. **Document upload** — bytes on disk with random names, metadata in Mongo; magic-byte validation; cleanup on rejection; authenticated file serving. Limits configurable.
6. **Status workflow** — centralized transition map; guarded atomic updates (`findOneAndUpdate` on current status) instead of transactions; `409` on invalid transitions; history array.
7. **Admin dashboard** — aggregation with `$match`/`$group` (≈ SQL GROUP BY) and `$lookup` for names.
8. **Testing** — Vitest + Supertest against a real MongoDB test DB; what's covered and what isn't.
9. **Simplifications / out of scope** — one application per applicant, no payments, scoring, email, JWT revocation, pagination, frontend automated tests.
10. **Possible extensions**.
