const fs = require('fs');
const path = require('path');
const multer = require('multer');

const CERT_DIR = path.join(__dirname, '..', '..', 'uploads', 'certificates');

function ensureDir() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }
}
ensureDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir();
    cb(null, CERT_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${req.params.id}_${Date.now()}${ext}`;
    cb(null, unique);
  },
});

// يسمح فقط بصور وملفات PDF للشهادات المرفوعة، وبحد أقصى 10 ميجابايت
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم - يُسمح فقط بـ PDF أو صور JPG/PNG/WEBP'));
    }
    cb(null, true);
  },
});

module.exports = { upload, CERT_DIR };
