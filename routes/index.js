const express = require('express');
const router = express.Router();

const videoRoutes = require('./video.routes');

router.use('/videos', videoRoutes);

module.exports = router;
