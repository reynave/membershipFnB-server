const { query } = require('../../config/db');
const { success } = require('../../helpers/response');

const list = async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, percentOfCashBack, accumulationAmount,
              minAmount, maxPercentOfBill, expDate, status, inputDate, updateDate
       FROM tier
       WHERE presence = 1
       ORDER BY id ASC`
    );
    return success(res, rows, 'Tiers fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list };
