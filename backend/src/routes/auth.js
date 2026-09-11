const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (!user || !user.is_active) {
      await logAudit({
        req, action: 'login_failed', entityType: 'User', userName: username,
        description: `محاولة تسجيل دخول فاشلة باسم مستخدم غير موجود أو معطّل: ${username}`,
      });
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const validPassword = await user.validatePassword(password);
    if (!validPassword) {
      await logAudit({
        req, action: 'login_failed', entityType: 'User', entityId: user.id, userName: user.full_name, userRole: user.role,
        description: `محاولة تسجيل دخول فاشلة (كلمة مرور خاطئة): ${user.full_name} (${username})`,
      });
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    await logAudit({
      action: 'login_success', entityType: 'User', entityId: user.id, userId: user.id, userName: user.full_name, userRole: user.role, req,
      description: `تسجيل دخول ناجح: ${user.full_name} (${username})`,
    });

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        is_department_head: user.is_department_head,
        department_id: user.department_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        is_department_head: user.is_department_head,
        department_id: user.department_id,
      },
    });
  }
);

// GET /api/auth/me - بيانات المستخدم الحالي
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'full_name', 'username', 'role', 'department_id', 'is_department_head'],
  });
  res.json(user);
});

module.exports = router;
