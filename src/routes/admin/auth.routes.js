const express = require("express");
const { body } = require("express-validator");
const validateRequest = require('../../middleware/validateRequest');
const { success } = require('../../helpers/response');
const authService = require('../../modules/auth/auth.service');

const router = express.Router();

router.post(
  "/register",
  [
    body("name").isString().trim().notEmpty().isLength({ min: 2, max: 120 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 6 })
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      return success(res, user, "Register success", 201);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      return success(res, result, "Login success", 200);
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
