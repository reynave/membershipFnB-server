const { success } = require('../../helpers/response');
const membershipAuthService = require('../../modules/membership/auth.service');

const register = async (req, res, next) => {
  try {
    const member = await membershipAuthService.register(req.body);
    return success(res, member, 'Membership register success', 201);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await membershipAuthService.login(req.body);
    return success(res, result, 'Membership login success', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login
};
