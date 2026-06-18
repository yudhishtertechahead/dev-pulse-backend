const createError = require('../../../src/utils/createError');

describe('createError', () => {
  it('should create an error with message and status', () => {
    const error = createError('Not found', 404);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
  });

  it('should default to 500 status if not provided', () => {
    const error = createError('Internal Error');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Internal Error');
    expect(error.status).toBe(500);
  });
});
