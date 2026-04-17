const express = require("express");
const auth = require('../../middleware/auth');
const { success } = require('../../helpers/response');
const authService = require('../../modules/auth/auth.service');
const memberService = require('../../modules/member/member.service');

const router = express.Router();

router.get("/profile", auth, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return success(res, profile, "Profile fetched", 200);
  } catch (error) {
    return next(error);
  }
});

router.get("/points/history", auth, async (req, res, next) => {
  try {
    const history = await memberService.getPointHistory(req.user.id);
    return success(res, history, "Point history fetched", 200);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
