const { protect, restrictTo } = require('../../../src/middleware/auth.middleware');
const { verifyAccessToken } = require('../../../src/utils/token.utils');

jest.mock('../../../src/utils/token.utils');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('protect', () => {
    it('should return 401 if no token provided', async () => {
      await protect(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No token provided', status: 401 }));
    });

    it('should return 401 if token is invalid', async () => {
      req.headers.authorization = 'Bearer invalidtoken';
      verifyAccessToken.mockImplementation(() => { throw new Error('Invalid token'); });
      
      await protect(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid or expired access token', status: 401 }));
    });

    it('should set req.user and call next if token is valid', async () => {
      req.headers.authorization = 'Bearer validtoken';
      verifyAccessToken.mockReturnValue({ userId: '1', sessionId: 's1', role: 'user' });
      
      await protect(req, res, next);
      
      expect(req.user).toEqual({ id: '1', sessionId: 's1', role: 'user' });
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('restrictTo', () => {
    it('should call next with 403 if user role is not authorized', () => {
      req.user = { role: 'user' };
      const middleware = restrictTo('admin');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'You do not have permission to perform this action', status: 403 }));
    });

    it('should call next if user role is authorized', () => {
      req.user = { role: 'admin' };
      const middleware = restrictTo('admin', 'manager');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
  });
});
