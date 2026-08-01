import { API_BASE_URL, UkuleleApi } from '../constants/ukulele-api';

describe('UkuleleApi Constants', () => {
  it('should have a valid base URL', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(API_BASE_URL).toMatch(/^http/);
  });

  it('should use the configured or fallback URL', () => {
    if (process.env.EXPO_PUBLIC_UKULELE_API_URL) {
      expect(API_BASE_URL).toBe(process.env.EXPO_PUBLIC_UKULELE_API_URL);
    } else {
      expect(API_BASE_URL).toMatch(/localhost|10\.0\.2\.2|8080/);
    }
  });
});

describe('UkuleleApi Methods', () => {
  const globalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
  });

  it('getGuilds fetches list of guilds', async () => {
    const mockGuilds = [{ id: '123', name: 'Test Guild', isPlaying: true }];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGuilds,
    });

    const guilds = await UkuleleApi.getGuilds();
    expect(guilds).toEqual(mockGuilds);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`${API_BASE_URL}/guilds`),
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('getPlayer fetches player status DTO', async () => {
    const mockStatus = {
      guildId: '123',
      isPaused: false,
      volume: 500,
      repeatTrack: false,
      queueLooping: false,
      currentTrack: {
        title: 'Song',
        author: 'Artist',
        uri: 'http://example.com/song.mp3',
        duration: 180000,
        position: 10000,
        isReplayGain: true,
        replayGainDb: -2.5,
      },
      remainingDuration: 170000,
      minVolume: 0,
      maxVolume: 800,
      isReplayGainEnabled: true,
      queueSize: 3,
      channelId: '999',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const status = await UkuleleApi.getPlayer('123');
    expect(status).toEqual(mockStatus);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123`,
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('getQueue fetches track list', async () => {
    const mockQueue = [
      {
        title: 'Track 1',
        author: 'Artist 1',
        uri: 'http://example.com/1',
        duration: 1000,
        position: 0,
        isReplayGain: false,
        replayGainDb: null,
      },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueue,
    });

    const queue = await UkuleleApi.getQueue('123');
    expect(queue).toEqual(mockQueue);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/queue`,
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('play sends POST request with URL and channelId', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });

    await UkuleleApi.play('123', 'http://example.com/song', 'channel-456', true);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/play`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'http://example.com/song', channelId: 'channel-456', fadeIn: true }),
      })
    );
  });

  it('pause sends POST request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.pause('123');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/pause`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('resume sends POST request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.resume('123');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/resume`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('skip sends POST request with index', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.skip('123', 2);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/skip`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ index: 2 }),
      })
    );
  });

  it('setVolume sends POST request with volume integer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.setVolume('123', 600);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/volume`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ volume: 600 }),
      })
    );
  });

  it('seek sends POST request with position', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.seek('123', 45000);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/seek`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ position: 45000 }),
      })
    );
  });

  it('removeTrack sends POST request with track index', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.removeTrack('123', 1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/remove`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ index: 1 }),
      })
    );
  });

  it('reorderQueue sends POST request with fromIndex and toIndex', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.reorderQueue('123', 0, 3);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/player/123/reorder`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fromIndex: 0, toIndex: 3 }),
      })
    );
  });

  it('getConfig fetches server config', async () => {
    const mockConfig = { useWebsockets: true, pollIntervalFast: 1000, pollIntervalSlow: 5000 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig,
    });
    const config = await UkuleleApi.getConfig();
    expect(config).toEqual(mockConfig);
  });

  it('getSecurityStats fetches unauthorized attempts count', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unauthorizedAttempts: 4 }),
    });
    const stats = await UkuleleApi.getSecurityStats();
    expect(stats).toEqual({ unauthorizedAttempts: 4 });
  });

  it('resetSecurityStats posts to security reset endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await UkuleleApi.resetSecurityStats();
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/security/reset`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});

