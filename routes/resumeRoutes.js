const express = require('express');
const router = express.Router();
const { analyzeResume } = require('../controllers/resumeController');

// Remove the fileUpload middleware here since it's already applied globally
router.post('/analyze-pdf', analyzeResume);

module.exports = router;