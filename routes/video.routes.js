const express = require('express');
const router = express.Router();
const videoController = require('../controller/video.controller');
const upload = require('../middleware/multer');
// Routes
router.post('/upload', upload.single('video'), videoController.uploadVideo);
router.post('/:id/trim', videoController.trimVideo);
router.post('/:id/subtitles', videoController.addSubtitles);
router.post('/:id/render', videoController.renderFinalVideo);
router.get('/:id/download', videoController.downloadVideo);

module.exports = router;
