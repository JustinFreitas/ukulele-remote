import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import AudioControllerScreen from '@/app/index';
import { UkuleleApi } from '@/constants/ukulele-api';
import WebSocketService from '@/services/WebSocketService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#000000',
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
  };
});

jest.mock('@/constants/ukulele-api', () => ({
  API_BASE_URL: 'http://localhost:8080/api',
  UkuleleApi: {
    getConfig: jest.fn(),
    getGuilds: jest.fn(),
    getChannels: jest.fn(),
    getPlayer: jest.fn(),
    getQueue: jest.fn(),
    getSecurityStats: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    skip: jest.fn(),
    setVolume: jest.fn(),
    stop: jest.fn(),
    shuffle: jest.fn(),
    setRepeat: jest.fn(),
    setLoop: jest.fn(),
    setFade: jest.fn(),
    fadeOut: jest.fn(),
    fadeIn: jest.fn(),
    seek: jest.fn(),
    move: jest.fn(),
    removeTrack: jest.fn(),
    reorderQueue: jest.fn(),
    resetSecurityStats: jest.fn(),
  },
}));

jest.mock('@/services/WebSocketService', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(() => false),
    forceReconnect: jest.fn(),
  },
}));

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('AudioControllerScreen (WebSocket, Polling, AppState & Fade Fixes)', () => {
  let appStateListener: ((state: string) => void) | null = null;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appStateListener = null;
    Platform.OS = 'ios';

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type: any, handler: any) => {
      appStateListener = handler;
      return { remove: jest.fn() } as any;
    });

    (UkuleleApi.getConfig as jest.Mock).mockResolvedValue({
      useWebsockets: true,
      pollIntervalFast: 2500,
      pollIntervalSlow: 5000,
    });
    (UkuleleApi.getGuilds as jest.Mock).mockResolvedValue([
      { id: 'guild-1', name: 'Test Guild', isPlaying: true },
    ]);
    (UkuleleApi.getChannels as jest.Mock).mockResolvedValue([
      { id: 'chan-1', name: 'General' },
    ]);
    (UkuleleApi.getPlayer as jest.Mock).mockResolvedValue({
      guildId: 'guild-1',
      isPaused: true,
      volume: 500,
      repeatTrack: false,
      queueLooping: false,
      currentTrack: null,
      remainingDuration: 0,
      minVolume: 0,
      maxVolume: 800,
      isReplayGainEnabled: true,
      queueSize: 0,
      channelId: 'chan-1',
      trackFade: true,
      isFadedOut: false,
    });
    (UkuleleApi.getQueue as jest.Mock).mockResolvedValue([]);
    (UkuleleApi.getSecurityStats as jest.Mock).mockResolvedValue({ unauthorizedAttempts: 0 });
    (UkuleleApi.play as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fetches config only once on startup, waits for STOMP before showing connected, and skips 5s HTTP player poll while connected', async () => {
    let wsOnConnect: (() => void) | undefined;
    let wsOnDisconnect: (() => void) | undefined;
    (WebSocketService.connect as jest.Mock).mockImplementation((_url, onConnect, onDisconnect) => {
      wsOnConnect = onConnect;
      wsOnDisconnect = onDisconnect;
    });

    const { getByText, unmount } = render(<AudioControllerScreen />);
    await flushMicrotasks();

    // Config fetched once despite guildId transitioning from null -> 'guild-1'
    expect(UkuleleApi.getConfig).toHaveBeenCalledTimes(1);
    expect(WebSocketService.connect).toHaveBeenCalledTimes(1);

    // Before STOMP connects, connectionStatus remains 'connecting'
    expect(getByText('⚡ WS (Connecting...)')).toBeTruthy();

    // Simulate STOMP connection established
    (WebSocketService.isConnected as jest.Mock).mockReturnValue(true);
    await act(async () => {
      wsOnConnect?.();
    });
    await flushMicrotasks();

    expect(getByText('⚡ WS')).toBeTruthy();

    // Clear initial player calls and advance slow queue loop (5000ms)
    (UkuleleApi.getPlayer as jest.Mock).mockClear();
    (UkuleleApi.getQueue as jest.Mock).mockClear();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flushMicrotasks();

    // Queue polls, but player HTTP polling is skipped because useWebsocketsRef is true & connected
    expect(UkuleleApi.getQueue).toHaveBeenCalledWith('guild-1');
    expect(UkuleleApi.getPlayer).not.toHaveBeenCalled();

    // Simulate STOMP disconnect -> HTTP fallback should resume on next slow poll
    (WebSocketService.isConnected as jest.Mock).mockReturnValue(false);
    await act(async () => {
      wsOnDisconnect?.();
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flushMicrotasks();

    expect(UkuleleApi.getPlayer).toHaveBeenCalledWith('guild-1');
    unmount();
  });

  it('passes autoFadeIn as 4th argument to UkuleleApi.play in handleLoadDefault and handleAddTrack', async () => {
    const { getByText, getByPlaceholderText, unmount } = render(<AudioControllerScreen />);
    await flushMicrotasks();

    // Initial getPlayer returned trackFade: true -> autoFadeIn === true
    fireEvent.press(getByText('Load Default'));
    await flushMicrotasks();

    expect(UkuleleApi.play).toHaveBeenCalledWith('guild-1', '', 'chan-1', true);

    const input = getByPlaceholderText('Search or Paste URL...');
    fireEvent.changeText(input, 'https://youtube.com/watch?v=abc');
    await act(async () => {
      fireEvent(input, 'submitEditing');
    });
    await flushMicrotasks();

    expect(UkuleleApi.play).toHaveBeenCalledWith('guild-1', 'https://youtube.com/watch?v=abc', 'chan-1', true);
    unmount();
  });

  it('does not force-disconnect healthy WebSockets on web tab focus and only reconnects on native after >20s background or disconnect', async () => {
    // 1. Web platform: should not register force-disconnect on AppState focus
    Platform.OS = 'web';
    const webRender = render(<AudioControllerScreen />);
    await flushMicrotasks();
    expect(appStateListener).toBeNull();
    expect(WebSocketService.forceReconnect).not.toHaveBeenCalled();
    webRender.unmount();

    // 2. Native platform: only force-reconnect if disconnected or backgrounded > 20s
    Platform.OS = 'ios';
    (WebSocketService.isConnected as jest.Mock).mockReturnValue(true);
    const nativeRender = render(<AudioControllerScreen />);
    await flushMicrotasks();
    expect(appStateListener).not.toBeNull();

    // Brief 5s background -> should NOT force-disconnect healthy socket
    act(() => {
      appStateListener?.('background');
      jest.advanceTimersByTime(5000);
      appStateListener?.('active');
    });
    expect(WebSocketService.forceReconnect).not.toHaveBeenCalled();

    // Long 25s background -> SHOULD force-reconnect
    act(() => {
      appStateListener?.('background');
      jest.advanceTimersByTime(25000);
      appStateListener?.('active');
    });
    expect(WebSocketService.forceReconnect).toHaveBeenCalledTimes(1);

    // Disconnected socket on active -> SHOULD force-reconnect immediately
    (WebSocketService.isConnected as jest.Mock).mockReturnValue(false);
    act(() => {
      appStateListener?.('active');
    });
    expect(WebSocketService.forceReconnect).toHaveBeenCalledTimes(2);

    nativeRender.unmount();
  });
});
