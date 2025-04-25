// middlewares/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads folder if not exists
const uploadPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only .mp4 and .mov formats are allowed!'));
    }
    cb(null, true);
  },
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1GB max
});

module.exports = upload;
