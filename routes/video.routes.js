const express = require('express');
const router = express.Router();
const videoController = require('../controller/video.controller');
const upload = require('../middleware/multer');
// Routes
router.get('/get/all', videoController.getAllVideos);
router.get('/:id', videoController.getVideoById);
router.post('/upload', upload.single('video'), videoController.uploadVideo);
router.delete('/:id', videoController.deleteVideo);
router.post('/:id/trim', videoController.trimVideo);
router.post('/:id/subtitles', videoController.addSubtitles);

module.exports = router;
