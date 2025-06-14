const express = require('express');
const router = express.Router();
const {auth, authorize} = require('../middlewares/auth.middleware');
const ragController = require('../controllers/rag.controller');
const {ragDocumentUpload} = require('../configs/multer');

router.post(
    '/documents',
    auth,
    authorize('admin'),
    ragDocumentUpload.array('files', 10),
    ragController.uploadDocuments
);
router.post(
    '/chat',
    auth,
    ragController.chat
);
router.get(
    '/documents',
    auth,
    authorize('admin'),
    ragController.getDocuments
);
router.delete(
    '/documents/:documentId',
    auth,
    authorize('admin'),
    ragController.deleteDocument
);

module.exports = router;