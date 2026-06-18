const errorMiddleware = require('../../../src/middleware/error.middleware');

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { method: 'GET', path: '/test' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    process.env.NODE_ENV = 'test';
  });

  it('should default to 500 status and "Internal server error"', () => {
    const err = new Error();
    errorMiddleware(err, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal server error' });
  });

  it('should handle custom status and message', () => {
    const err = new Error('Custom error');
    err.status = 400;
    errorMiddleware(err, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Custom error' });
  });

  it('should handle pg unique violation (23505)', () => {
    const err = { code: '23505' };
    errorMiddleware(err, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Email already in use' });
  });

  it('should handle JsonWebTokenError', () => {
    const err = { name: 'JsonWebTokenError' };
    errorMiddleware(err, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
  });

  it('should handle TokenExpiredError', () => {
    const err = { name: 'TokenExpiredError' };
    errorMiddleware(err, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token has expired' });
  });

  it('should include stack trace in development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Test stack');
    err.stack = 'stack trace';
    
    // Suppress console.error in test
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    errorMiddleware(err, req, res, next);
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ stack: 'stack trace' }));
    process.env.NODE_ENV = 'test';
    console.error.mockRestore();
  });
});
