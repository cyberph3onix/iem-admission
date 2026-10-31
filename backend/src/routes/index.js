const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const authorizeRole = require('../middleware/authorizeRole');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');
const auth = require('../controllers/auth.controller');
const course = require('../controllers/course.controller');
const application = require('../controllers/application.controller');
const document = require('../controllers/document.controller');
const admin = require('../controllers/admin.controller');
const fee = require('../controllers/fee.controller');

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', authenticate, auth.me);

router.get('/courses', authenticate, course.list);
router.get('/document-types', authenticate, document.listTypes);

const applicant = [authenticate, authorizeRole(ROLES.APPLICANT)];
router.post('/applications', applicant, application.create);
router.get('/applications/me', applicant, application.getMine);
router.patch('/applications/me', applicant, application.updateMine);
router.post('/applications/me/submit', applicant, application.submit);
router.post('/applications/me/documents', applicant, upload, document.upload);
router.get('/applications/me/documents', applicant, document.listMine);
router.post('/applications/me/fee', applicant, fee.create);
router.get('/applications/me/fee', applicant, fee.getMine);
router.get('/applications/me/documents/:docId/file', applicant, document.downloadMine);

const adminOnly = [authenticate, authorizeRole(ROLES.ADMIN)];
router.get('/admin/dashboard', adminOnly, admin.dashboard);
router.get('/admin/applications', adminOnly, admin.list);
router.get('/admin/applications/:id', adminOnly, admin.get);
router.patch('/admin/applications/:id/verification', adminOnly, admin.verify);
router.patch('/admin/applications/:id/status', adminOnly, admin.changeStatus);
router.get('/admin/documents/:docId/file', adminOnly, document.downloadAny);

module.exports = router;
