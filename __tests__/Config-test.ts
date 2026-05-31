import { Config } from '../constants/Config';

describe('Config', () => {
  it('should have default values for polling intervals', () => {
    expect(Config.POLL_INTERVAL_FAST).toBeDefined();
    expect(Config.POLL_INTERVAL_SLOW).toBeDefined();
    expect(typeof Config.POLL_INTERVAL_FAST).toBe('number');
  });

  it('should have default values for volume steps', () => {
    expect(Config.VOL_STEP_SMALL).toBe(1);
    expect(Config.VOL_STEP_MEDIUM).toBe(5);
    expect(Config.VOL_STEP_LARGE).toBe(10);
  });
});
