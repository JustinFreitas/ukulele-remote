import { API_BASE_URL } from '../constants/ukulele-api';

describe('UkuleleApi Constants', () => {
  it('should have a valid base URL', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(API_BASE_URL).toMatch(/^http/);
  });

  it('should use the configured or fallback URL', () => {
    // The test environment picks up the local .env file
    if (process.env.EXPO_PUBLIC_UKULELE_API_URL) {
      expect(API_BASE_URL).toBe(process.env.EXPO_PUBLIC_UKULELE_API_URL);
    } else {
      expect(API_BASE_URL).toMatch(/localhost|10\.0\.2\.2|8080/);
    }
  });
});
