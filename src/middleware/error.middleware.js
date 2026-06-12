module.exports = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.code === '23505') {
    status = 409;
    message = 'Email already in use';
  }

  if (err.code === '23503') {
    status = 400;
    message = 'Referenced resource does not exist';
  }

  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token has expired';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${new Date().toISOString()}] ${status} ${req.method} ${req.path}`);
    console.error(err.stack);
  } else {
    if (status >= 500) {
      console.error(`[${new Date().toISOString()}] 500 — ${message}`);
    }
  }

  const response = {
    success: false,
    error: message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};
