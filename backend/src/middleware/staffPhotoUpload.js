const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PHOTO_DIR = path.join(__dirname, '..', '..', 'uploads', 'staff-photos');

function ensureDir() {
  if (!fs.existsSync(PHOTO_DIR)) {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
  }
}
ensureDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir();
    cb(null, PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${req.params.id}_${Date.now()}${ext}`;
    cb(null, unique);
  },
});

// الصورة الشخصية: صور فقط، بحد أقصى 5 ميجابايت
const uploadStaffPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم - يُسمح فقط بصور JPG/PNG/WEBP'));
    }
    cb(null, true);
  },
});

module.exports = { uploadStaffPhoto, PHOTO_DIR };
