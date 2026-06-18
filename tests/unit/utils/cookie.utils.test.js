const { getCookieOptions, clearCookieOptions } = require('../../../src/utils/cookie.utils');

describe('Cookie Utils', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('getCookieOptions', () => {
    it('should return session cookie options when rememberMe is false', () => {
      const options = getCookieOptions(false);
      expect(options.maxAge).toBeUndefined();
      expect(options.httpOnly).toBe(true);
    });

    it('should return persistent cookie options when rememberMe is true', () => {
      const options = getCookieOptions(true);
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
      expect(options.httpOnly).toBe(true);
    });

    it('should set secure=true and sameSite=none in production', () => {
      process.env.NODE_ENV = 'production';
      const options = getCookieOptions();
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
    });

    it('should set secure=false and sameSite=strict in development', () => {
      process.env.NODE_ENV = 'development';
      const options = getCookieOptions();
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('strict');
    });
  });

  describe('clearCookieOptions', () => {
    it('should return options to clear the cookie', () => {
      const options = clearCookieOptions();
      expect(options.maxAge).toBe(0);
      expect(options.expires).toBeInstanceOf(Date);
      expect(options.expires.getTime()).toBe(0);
    });
  });
});
