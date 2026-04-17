const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const authController = require('../../controllers/membership/auth.controller');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').isString().trim().notEmpty().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 })
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validateRequest,
  authController.login
);

module.exports = router;
