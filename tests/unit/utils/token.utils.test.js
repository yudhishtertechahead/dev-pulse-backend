const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry
} = require('../../../src/utils/token.utils');

describe('Token Utils', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env.JWT_ACCESS_SECRET = 'access_secret';
    process.env.JWT_REFRESH_SECRET = 'refresh_secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken({ userId: 'user-1', role: 'user', sessionId: 'session-1' });
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      expect(decoded.userId).toBe('user-1');
      expect(decoded.role).toBe('user');
      expect(decoded.sessionId).toBe('session-1');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken({ userId: 'user-1', sessionId: 'session-1' });
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(decoded.userId).toBe('user-1');
      expect(decoded.sessionId).toBe('session-1');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken({ userId: 'user-1', role: 'user', sessionId: 'session-1' });
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe('user-1');
    });

    it('should throw an error for an invalid access token', () => {
      expect(() => verifyAccessToken('invalid_token')).toThrow(jwt.JsonWebTokenError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken({ userId: 'user-1', sessionId: 'session-1' });
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe('user-1');
    });
  });

  describe('hashToken', () => {
    it('should generate a sha256 hash of the token', () => {
      const token = 'my-token';
      const hash = hashToken(token);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // sha256 hex is 64 chars
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a date in the future', () => {
      const expiryDate = getRefreshTokenExpiry();
      expect(expiryDate).toBeInstanceOf(Date);
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
