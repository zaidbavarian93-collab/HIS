const fs = require('fs');
const path = require('path');
const multer = require('multer');

const LOGO_DIR = path.join(__dirname, '..', '..', 'uploads', 'department-logos');

function ensureDir() {
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }
}
ensureDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir();
    cb(null, LOGO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${req.params.id}_${Date.now()}${ext}`;
    cb(null, unique);
  },
});

// شعار القسم: صور فقط (لا PDF)، بحد أقصى 5 ميجابايت
const uploadDepartmentLogo = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم - يُسمح فقط بصور JPG/PNG/WEBP/SVG'));
    }
    cb(null, true);
  },
});

module.exports = { uploadDepartmentLogo, LOGO_DIR };
