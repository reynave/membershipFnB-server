const success = (res, data, message = "OK", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const fail = (res, message = "Bad Request", statusCode = 400, errors) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: errors || null
  });
};

module.exports = {
  success,
  fail
};
