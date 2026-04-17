const { fail, success } = require('../../helpers/response');
const redeemService = require('../../modules/membership/redeem.service');

const validateRedeemPointRequest = (req) => {
  const errors = [];
  const token = req.header('token');
  const { redeemCode, amount, transactionId } = req.body || {};

  if (typeof token !== 'string' || !token.trim()) {
    errors.push({ field: 'token', message: 'token header is required' });
  }

  if (typeof redeemCode !== 'string' || !redeemCode.trim()) {
    errors.push({ field: 'redeemCode', message: 'redeemCode is required' });
  } else if (redeemCode.trim().length > 50) {
    errors.push({ field: 'redeemCode', message: 'redeemCode must be 50 characters or less' });
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    errors.push({ field: 'amount', message: 'amount must be a number greater than 0' });
  }

  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    errors.push({ field: 'transactionId', message: 'transactionId is required' });
  } else if (transactionId.trim().length > 50) {
    errors.push({ field: 'transactionId', message: 'transactionId must be 50 characters or less' });
  }

  return errors;
};

const redeemPoint = async (req, res, next) => {
  try {
    const errors = validateRedeemPointRequest(req);

    if (errors.length > 0) {
      return fail(res, 'Validation failed', 422, errors);
    }

    const result = await redeemService.redeemPoint({
      token: req.header('token'),
      payload: req.body,
      io: req.io
    });

    return success(res, result, 'Point redeemed successfully', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  redeemPoint
};
