import { Config } from '@/constants/Config';

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AudioPlayer } from '@/components/AudioPlayer';
import { QueueList, Track } from '@/components/QueueList';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VoiceChannelSelector } from '@/components/VoiceChannelSelector';
import { API_BASE_URL, UkuleleApi, VoiceChannelDto } from '@/constants/ukulele-api';
import WebSocketService from '@/services/WebSocketService';

if (Platform.OS === 'web') {
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const formattedMessage = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length === 0) {
      window.alert(formattedMessage);
      return;
    }

    const hasCancel = buttons.some(b => b.style === 'cancel' || b.text?.toLowerCase() === 'cancel');
    const confirmButton = buttons.find(b => b.style !== 'cancel' && b.text?.toLowerCase() !== 'cancel');

    if (hasCancel && confirmButton) {
      const confirmed = window.confirm(formattedMessage);
      if (confirmed && confirmButton.onPress) {
        confirmButton.onPress();
      }
    } else {
      window.alert(formattedMessage);
      const okButton = buttons[0];
      if (okButton && okButton.onPress) {
        okButton.onPress();
      }
    }
  };
}

export default function AudioControllerScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState({ minVolume: 0, maxVolume: 80, isReplayGain: false, replayGainDb: null as number | null, isReplayGainEnabled: false, queueSize: 0 });
  const [useWebsockets, setUseWebsockets] = useState(false);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [loop, setLoop] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedAttempts, setUnauthorizedAttempts] = useState(0);

  // Seek bar state
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastVolumeUpdate = useRef(0);
  const lastSeekTime = useRef(0);

  // Polling intervals (overridden by server config when available)
  const pollIntervalFast = useRef(Config.POLL_INTERVAL_FAST);
  const pollIntervalSlow = useRef(Config.POLL_INTERVAL_SLOW);

  // Mirror connectionStatus into a ref so polling loops can read it without
  // being torn down and rebuilt every time the status changes.
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  // Ref to hold the latest player status update handler to avoid stale closures
  const statusUpdateRef = useRef<(status: any) => void>(() => {});
  useEffect(() => {
    statusUpdateRef.current = handlePlayerStatusUpdate;
  });

  // Fade state
  const fadeInterval = useRef<any>(null);
  const preFadeVolume = useRef<number>(0.5);
  const [autoFadeIn, setAutoFadeIn] = useState(false);
  const lastTrackId = useRef<string | null>(null);
  
  // Volume throttling refs
  const lastVolumeApiCall = useRef<number>(0);
  const volumeDebounceTimeout = useRef<any>(null);
  const pendingVolumeInt = useRef<number | null>(null);

  // Channels
  const [channels, setChannels] = useState<VoiceChannelDto[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // AppState Reconnection
  // When the app returns to the foreground the WebSocket may have been silently
  // killed by the OS while suspended. stompjs would only notice on its next
  // heartbeat (~20s), so force a reconnect immediately to resync faster.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && useWebsockets) {
        WebSocketService.forceReconnect();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [useWebsockets]);

  // Dead Reckoning Effect
  useEffect(() => {
    let interval: any;
    if (isPlaying && duration > 0) {
      interval = setInterval(() => {
        setPosition(p => Math.min(p + 100, duration));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  useEffect(() => {
    let isMounted = true;
    let statusTimeout: any;
    let queueTimeout: any;

    const runStatusLoop = async () => {
      if (!isMounted) return;

      // Determine what to do based on current state (captured in closure or via refs if needed, 
      // but since we are in useEffect dependent on guildId, we can use it directly)

      try {
        if (guildId) {
          await fetchPlayerState();
        } else {
          await loadGuilds();
        }
      } catch (e) {
        console.warn("Polling error:", e);
      }

      if (isMounted) {
        statusTimeout = setTimeout(runStatusLoop, pollIntervalFast.current);
      }
    };

    const runQueueLoop = async () => {
      if (!isMounted) return;

      try {
        // Read status from a ref so this loop isn't torn down on every status change.
        if (guildId && connectionStatusRef.current === 'connected') {
          await fetchQueue(guildId);
          await fetchSecurityStats();
          // Ensure we get player state even if WS fails
          await fetchPlayerState();
        }
      } catch (e) {
        console.warn("Queue polling error:", e);
      }

      if (isMounted) {
        queueTimeout = setTimeout(runQueueLoop, pollIntervalSlow.current);
      }
    };

    const setupConnection = async () => {
      // 1. Fetch Config
      try {
        const config = await UkuleleApi.getConfig();
        if (!isMounted) return;
        setUseWebsockets(config.useWebsockets);

        // Honor server-provided poll intervals when present.
        if (config.pollIntervalFast > 0) pollIntervalFast.current = config.pollIntervalFast;
        if (config.pollIntervalSlow > 0) pollIntervalSlow.current = config.pollIntervalSlow;

        // 2. Decide Mode
        if (config.useWebsockets) {
          // WebSocket Mode
          console.log("Switching to WebSocket mode");
          if (guildId) {
            // Derive WS URL from API URL (strip /api)
            const wsBase = API_BASE_URL.replace(/\/api$/, '');
            WebSocketService.connect(
              wsBase,
              () => {
                if (isMounted) {
                  setConnectionStatus('connected');
                  setErrorMessage(null);
                  WebSocketService.subscribe(`/topic/player/${guildId}`, (status: any) => {
                    statusUpdateRef.current(status);
                  });
                }
              },
              () => {
                if (isMounted) {
                  setConnectionStatus('connecting');
                }
              },
              (err: any) => {
                if (isMounted) {
                  console.error("WS Error", err);
                  setConnectionStatus('error');
                  setErrorMessage(err?.message || "WebSocket connection failed");
                }
              }
            );
          }
        } else {
          // Polling Mode
          console.log("Switching to Polling mode");
          // Start the recursive status loop
          // Wait for first interval before running
          statusTimeout = setTimeout(runStatusLoop, pollIntervalFast.current);
        }
      } catch (e) {
        if (!isMounted) return;
        console.warn("Failed to fetch config, defaulting to polling", e);
        // Fallback polling
        statusTimeout = setTimeout(runStatusLoop, pollIntervalFast.current);
      }

      // Queue & Security Polling (Always poll these for now, or move them to WS too later)
      queueTimeout = setTimeout(() => {
        void runQueueLoop();
      }, pollIntervalSlow.current);
    };

    void setupConnection();

    // Initial load
    if (!guildId) {
      void loadGuilds();
    }

    return () => {
      isMounted = false;
      clearTimeout(statusTimeout);
      clearTimeout(queueTimeout);
      if (fadeInterval.current) {
        clearInterval(fadeInterval.current);
      }
      WebSocketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const fetchChannels = async (gid: string) => {
    try {
      const chans = await UkuleleApi.getChannels(gid);
      setChannels(chans);
      if (chans.length > 0 && !selectedChannelId) {
        setSelectedChannelId(chans[0].id); // Select the first channel by default
      }
    } catch (e) { console.error("Failed to fetch channels", e); }
  };

  const loadGuilds = async () => {
    // console.log("DEBUG: loadGuilds started");
    try {
      const guilds = await UkuleleApi.getGuilds();
      // console.log("DEBUG: loadGuilds found:", guilds.length);
      if (guilds.length > 0) {
        // Find a guild that is playing, or default to the first one
        const activeGuild = guilds.find(g => g.isPlaying) || guilds[0];
        setGuildId(activeGuild.id);
        void fetchChannels(activeGuild.id); // Fetch channels for the selected guild
        setConnectionStatus('connected');
        // console.log("DEBUG: calling fetchPlayerState from loadGuilds for", activeGuild.name);
        void fetchPlayerState(activeGuild.id);
        void fetchQueue(activeGuild.id);
        void fetchSecurityStats();
      }

    } catch (e: any) {
      console.error('Failed to load guilds', e);
      setConnectionStatus('error');
      setErrorMessage(e.message || "Failed to connect to server");
    }
  };

  const fetchPlayerState = async (overrideGuildId?: string) => {
    const targetId = overrideGuildId || guildId;
    if (!targetId) return;
    try {
      const status = await UkuleleApi.getPlayer(targetId);
      // console.log("DEBUG: fetchPlayerState status:", JSON.stringify(status));
      statusUpdateRef.current(status);
    } catch (e: any) {
      console.error("fetchPlayerState error:", e);
      setConnectionStatus('error');
      let msg = e.message || "Unknown error";
      if (msg.includes("Network request failed") || msg.includes("timeout")) {
        msg = "Server unreachable or offline";
      }
      setErrorMessage(msg);
    }
  };

  const handlePlayerStatusUpdate = (status: any) => {
    // console.log("DEBUG: Handling status update", status);
    if (connectionStatus === 'error') {
      setConnectionStatus('connected');
      setErrorMessage(null);
    }

    setIsPlaying(!status.isPaused);

    // Position Sync
    // Only sync if difference is significant (>2s) to avoid jitter fighting local interpolation.
    // Also ignore updates for 3s after a user seek to prevent optimistic state fightback.
    if (status.currentTrack) {
      setDuration(status.currentTrack.duration);
      if (Date.now() - lastSeekTime.current > 3000) {
        if (Math.abs(status.currentTrack.position - position) > 2000) {
          setPosition(status.currentTrack.position);
        }
      }
    } else {
      setDuration(0);
      setPosition(0);
    }

    // Volume Sync
    if (Date.now() - lastVolumeUpdate.current > 2000) {
      setVolume(status.volume / 1000);
    }

    setRepeat(status.repeatTrack);
    setLoop(status.queueLooping);

    // Auto Fade In Logic
    const newTrackId = status.currentTrack?.uri || null;
    if (newTrackId !== lastTrackId.current) {
      if (newTrackId && autoFadeIn) {
        console.log("Auto Fade In Triggered");
        performFadeIn();
        setAutoFadeIn(false);
      }
      lastTrackId.current = newTrackId;
    }
    setCurrentTrack(status.currentTrack?.title || null);
    if (status.minVolume !== undefined) {
      setServerStats({
        minVolume: status.minVolume,
        maxVolume: status.maxVolume,
        isReplayGain: status.currentTrack?.isReplayGain || false,
        replayGainDb: status.currentTrack?.replayGainDb ?? null,
        isReplayGainEnabled: status.isReplayGainEnabled,
        queueSize: status.queueSize || 0
      });
    }

    // Sync Channel ID
    if (status.channelId) {
      setSelectedChannelId((prev) => (prev !== status.channelId ? status.channelId : prev));
    }
  };

  const fetchSecurityStats = async () => {
    try {
      const stats = await UkuleleApi.getSecurityStats();
      setUnauthorizedAttempts(stats.unauthorizedAttempts);
    } catch {
      // console.warn("Failed to fetch security stats");
    }
  };

  const fetchQueue = async (overrideGuildId?: string) => {
    const targetId = overrideGuildId || guildId;
    if (!targetId) return;
    try {
      const tracks = await UkuleleApi.getQueue(targetId);
      setQueue(tracks.map((t, i) => ({
        id: t.uri + i,
        title: t.title,
        artist: t.author
      })));
    } catch {
      // console.warn("Failed to fetch queue");
    }
  };

  const handlePlayPause = async () => {
    if (!guildId) return;
    try {
      if (isPlaying) {
        await UkuleleApi.pause(guildId);
      } else {
        await UkuleleApi.resume(guildId);
      }
      setIsPlaying(!isPlaying);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleNext = async () => {
    if (!guildId) return;
    try {
      await UkuleleApi.skip(guildId);
      await fetchPlayerState();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handlePrev = () => {
    Alert.alert("Previous track not supported");
  };

  const handleVolumeChange = async (newVol: number) => {
    // If user manually changes volume, stop any active fade
    if (fadeInterval.current) {
      clearInterval(fadeInterval.current);
      fadeInterval.current = null;
    }

    if (!guildId) return;
    const clampedVol = Math.max(0, Math.min(1, newVol));
    const volInt = Math.round(clampedVol * 1000);
    
    // Update local UI immediately for smooth sliding
    lastVolumeUpdate.current = Date.now();
    setVolume(clampedVol);

    // Throttle API requests: send immediately if it has been > 300ms since the last call,
    // otherwise debounce and send the final value after the user stops sliding.
    pendingVolumeInt.current = volInt;

    if (volumeDebounceTimeout.current) {
      clearTimeout(volumeDebounceTimeout.current);
      volumeDebounceTimeout.current = null;
    }

    const now = Date.now();
    if (now - lastVolumeApiCall.current > 300) {
      // Send immediately
      lastVolumeApiCall.current = now;
      pendingVolumeInt.current = null;
      try {
        await UkuleleApi.setVolume(guildId, volInt);
      } catch (e: any) {
        console.error("Volume API error:", e);
      }
    } else {
      // Debounce and send the last value
      volumeDebounceTimeout.current = setTimeout(async () => {
        if (pendingVolumeInt.current !== null && guildId) {
          const finalVol = pendingVolumeInt.current;
          pendingVolumeInt.current = null;
          lastVolumeApiCall.current = Date.now();
          try {
            await UkuleleApi.setVolume(guildId, finalVol);
          } catch (e: any) {
            console.error("Volume API error (debounced):", e);
          }
        }
      }, 300);
    }
  };

  const handleFadeOut = () => {
    if (fadeInterval.current) clearInterval(fadeInterval.current);

    // Save current volume to return to later (unless it's already near 0)
    if (volume > 0.05) {
      preFadeVolume.current = volume;
    }

    const STEPS = 20;
    const DURATION = 2000; // 2 seconds
    const intervalTime = DURATION / STEPS;
    const startVol = volume;
    const step = startVol / STEPS;

    let currentStep = 0;

    fadeInterval.current = setInterval(() => {
      currentStep++;
      const newVol = Math.max(0, startVol - (step * currentStep));

      // Update local state and invalidating sync lock
      setVolume(newVol);
      lastVolumeUpdate.current = Date.now();

      // Fire and forget volume update
      if (guildId) {
        const volInt = Math.round(newVol * 1000);
        UkuleleApi.setVolume(guildId, volInt).catch(() => { });
      }

      if (currentStep >= STEPS || newVol <= 0) {
        clearInterval(fadeInterval.current);
        fadeInterval.current = null;
      }
    }, intervalTime);
  };

  const performFadeIn = () => {
    if (fadeInterval.current) clearInterval(fadeInterval.current);

    const targetVol = Math.max(0.1, preFadeVolume.current); // return to pre-fade or at least 10%
    if (volume >= targetVol) return; // Already there

    const STEPS = 20;
    const DURATION = 2000; // 2 seconds
    const intervalTime = DURATION / STEPS;
    const startVol = volume;
    const range = targetVol - startVol;
    const step = range / STEPS;

    let currentStep = 0;

    fadeInterval.current = setInterval(() => {
      currentStep++;
      const newVol = Math.min(targetVol, startVol + (step * currentStep));

      setVolume(newVol);
      lastVolumeUpdate.current = Date.now();

      if (guildId) {
        const volInt = Math.round(newVol * 1000);
        UkuleleApi.setVolume(guildId, volInt).catch(() => { });
      }

      if (currentStep >= STEPS || newVol >= targetVol) {
        clearInterval(fadeInterval.current);
        fadeInterval.current = null;
      }
    }, intervalTime);
  };

  const handleFadeIn = () => {
    // If volume is basically silent, just fade in now
    if (volume < 0.05) {
      performFadeIn();
      setAutoFadeIn(false); // Disarm if it was armed
    } else {
      // Otherwise toggle the "Arm" state for the next track
      setAutoFadeIn(!autoFadeIn);
    }
  };

  const handleSeek = async (pos: number) => {
    if (!guildId) return;
    setPosition(pos); // Optimistic update
    lastSeekTime.current = Date.now();
    try {
      await UkuleleApi.seek(guildId, pos);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRemoveTrack = async (id: string) => {
    if (!guildId) return;
    const index = queue.findIndex(t => t.id === id);
    if (index === -1) return;
    try {
      await UkuleleApi.removeTrack(guildId, index);
      // Let the socket status update update the queue size and trigger fetchQueue, or fetch now
      await fetchQueue();
    } catch (e: any) {
      Alert.alert("Failed to remove track", e.message);
    }
  };

  const handlePlayTrack = (_id: string, index: number) => {
    if (!guildId) return;
    Alert.alert(
      "Jump to Track?",
      `Skip to track #${index + 1}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Jump",
          onPress: async () => {
            await UkuleleApi.skip(guildId, index);
            setTimeout(() => {
              void fetchPlayerState();
              void fetchQueue();
            }, 500);
          }
        }
      ]
    );
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!guildId) return;
    try {
      await UkuleleApi.reorderQueue(guildId, fromIndex, toIndex);
      await fetchQueue();
    } catch (e: any) {
      Alert.alert("Failed to reorder queue", e.message);
    }
  };

  const handleStop = async () => {
    if (!guildId) return;
    Alert.alert(
      "Stop Player?",
      "This will clear the queue and disconnect the bot.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            try {
              await UkuleleApi.stop(guildId);
              await fetchPlayerState();
            } catch (e: any) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  const handleShuffle = async () => {
    if (!guildId) return;
    try {
      await UkuleleApi.shuffle(guildId);
      await fetchPlayerState();
    } catch (e: any) {
      console.error(e);
    }
  };

  const toggleRepeat = async () => {
    if (!guildId) return;
    try {
      await UkuleleApi.setRepeat(guildId, !repeat);
      setRepeat(!repeat);
    } catch (e: any) {
      console.error(e);
    }
  };

  const toggleLoop = async () => {
    if (!guildId) return;
    try {
      await UkuleleApi.setLoop(guildId, !loop);
      setLoop(!loop);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleChannelSelect = async (channelId: string) => {
    setSelectedChannelId(channelId);
    if (!guildId) return;
    if (isPlaying) {
      try {
        await UkuleleApi.move(guildId, channelId);
      } catch (e) {
        console.error("Failed to move bot", e);
      }
    }
  };

  const handleLoadDefault = async () => {
    if (!guildId) return;
    try {
      if (autoFadeIn) {
        await UkuleleApi.setVolume(guildId, 0);
      }
      await UkuleleApi.play(guildId, "", selectedChannelId || undefined, autoFadeIn);
      await fetchPlayerState();
      setTimeout(() => { void fetchQueue(); }, 500); // Give it a moment to load
      setTimeout(() => { void fetchPlayerState(); }, 1000); // Check again once loaded
    } catch (e: any) {
      console.error(e);
      Alert.alert("Failed to load default playlist", e.message);
    }
  };

  const handleAddTrack = async (url: string) => {
    if (!guildId) return;
    await UkuleleApi.play(guildId, url, selectedChannelId || undefined, autoFadeIn);
    await fetchPlayerState();
    setTimeout(() => { void fetchQueue(); }, 500);
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.pageTitle}>Ukulele</ThemedText>
          <TouchableOpacity onPress={() => {
            if (connectionStatus === 'error' && errorMessage) {
              Alert.alert("Connection Error", errorMessage);
            }
          }}>
            <View style={[
              styles.statusBubble,
              { backgroundColor: connectionStatus === 'connected' ? 'green' : connectionStatus === 'connecting' ? 'orange' : 'red' }
            ]} />
          </TouchableOpacity>
          {unauthorizedAttempts > 0 && (
            <TouchableOpacity onPress={() => {
              Alert.alert(
                "Reset Counter?",
                "Reset unauthorized attempts count to 0?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                      await UkuleleApi.resetSecurityStats();
                      await fetchSecurityStats();
                    }
                  }
                ]
              );
            }}>
              <ThemedText style={{ color: 'red', marginLeft: 5, fontSize: 24, fontWeight: 'bold' }}>
                ({unauthorizedAttempts})
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Voice Channel Selector */}
        <VoiceChannelSelector
          channels={channels}
          selectedChannelId={selectedChannelId}
          onSelectChannel={handleChannelSelect}
        />

        {connectionStatus === 'connecting' && (
          <ThemedText style={styles.statusText}>Connecting to Ukulele...</ThemedText>
        )}

        <AudioPlayer
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          currentTrack={currentTrack}
          minVolume={serverStats.minVolume}
          maxVolume={serverStats.maxVolume}
          position={position}
          duration={duration}
          onSeek={handleSeek}
          isReplayGain={serverStats.isReplayGain} // We need to store this in state
          replayGainDb={serverStats.replayGainDb}
          isReplayGainEnabled={serverStats.isReplayGainEnabled}
          hasNext={serverStats.queueSize > 0 || repeat || loop}
          onFadeIn={handleFadeIn}
          onFadeOut={handleFadeOut}
          onStop={handleStop}
          onShuffle={handleShuffle}
          onToggleRepeat={toggleRepeat}
          onToggleLoop={toggleLoop}
          repeat={repeat}
          loop={loop}
          autoFadeIn={autoFadeIn}
        />

        <QueueList
          queue={queue}
          onRemove={handleRemoveTrack}
          onPlay={handlePlayTrack}
          onReorder={handleReorder}
          onLoadDefault={handleLoadDefault}
          onAddTrack={handleAddTrack}
        />
      </ThemedView>
      <View style={{ position: 'absolute', bottom: 20, right: 20, opacity: 0.5 }}>
        <ThemedText type="defaultSemiBold" style={{ fontSize: 10 }}>
          {useWebsockets ? (connectionStatus === 'connected' ? '⚡ WS' : '⚡ WS (Connecting...)') : '🔄 POLL'}
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 10,
  },
  pageTitle: {
    marginBottom: 0,
  },
  statusBubble: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    marginBottom: 10,
    fontStyle: 'italic',
  },
});
