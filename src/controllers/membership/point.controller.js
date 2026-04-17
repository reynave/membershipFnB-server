const { fail, success } = require('../../helpers/response');
const pointService = require('../../modules/membership/point.service');

const mysqlDateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const isValidDateTime = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  return mysqlDateTimePattern.test(trimmedValue) || !Number.isNaN(new Date(trimmedValue).getTime());
};

const validateCreateTransactionRequest = (req) => {
  const errors = [];
  const token = req.header('token');
  const { bill, totalAmount, billDate, note, memberId } = req.body || {};

  if (typeof token !== 'string' || !token.trim()) {
    errors.push({ field: 'token', message: 'token header is required' });
  }

  if (typeof bill !== 'string' || !bill.trim()) {
    errors.push({ field: 'bill', message: 'bill is required' });
  } else if (bill.trim().length > 50) {
    errors.push({ field: 'bill', message: 'bill must be 50 characters or less' });
  }

  if (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) <= 0) {
    errors.push({ field: 'totalAmount', message: 'totalAmount must be a number greater than 0' });
  }

  if (!isValidDateTime(billDate)) {
    errors.push({ field: 'billDate', message: 'billDate must be a valid datetime' });
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    errors.push({ field: 'note', message: 'note must be a string' });
  } else if (typeof note === 'string' && note.length > 250) {
    errors.push({ field: 'note', message: 'note must be 250 characters or less' });
  }

  if (typeof memberId !== 'string' || !memberId.trim()) {
    errors.push({ field: 'memberId', message: 'memberId is required' });
  } else if (memberId.trim().length > 50) {
    errors.push({ field: 'memberId', message: 'memberId must be 50 characters or less' });
  }

  return errors;
};

const createTransactionPoint = async (req, res, next) => {
  try {
    const errors = validateCreateTransactionRequest(req);

    if (errors.length > 0) {
      return fail(res, 'Validation failed', 422, errors);
    }

    const result = await pointService.createTransactionPoint({
      token: req.header('token'),
      payload: req.body
    });

    return success(res, result, 'Membership point transaction created', 201);
  } catch (error) {
    return next(error);
  }
};

const getTotalPoints = async (req, res, next) => {
  try {
    const memberId = req.user.id;
    const result = await pointService.getTotalPoints(memberId);

    return success(res, result, 'Total points fetched', 200);
  } catch (error) {
    return next(error);
  }
};

const getPointHistory = async (req, res, next) => {
  try {
    const memberId = req.user.id;
    const result = await pointService.getPointHistory(memberId);

    return success(res, result, 'Point history fetched', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createTransactionPoint,
  getTotalPoints,
  getPointHistory
};