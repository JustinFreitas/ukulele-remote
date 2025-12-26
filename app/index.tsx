import { Config } from '@/constants/Config';
import Constants from 'expo-constants';

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, LogBox, Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

LogBox.ignoreAllLogs();

import { AudioPlayer } from '@/components/AudioPlayer';
import { QueueList, Track } from '@/components/QueueList';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_BASE_URL, UkuleleApi } from '@/constants/ukulele-api';
import { useThemeColor } from '@/hooks/use-theme-color';
import WebSocketService from '@/services/WebSocketService';
import { Ionicons } from '@expo/vector-icons';

export default function AudioControllerScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState({ minVolume: 0, maxVolume: 100, isReplayGain: false, isReplayGainEnabled: false });
  const [useWebsockets, setUseWebsockets] = useState(false);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [loop, setLoop] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedAttempts, setUnauthorizedAttempts] = useState(0);
  const [metroDisconnected, setMetroDisconnected] = useState(false);


  // Seek bar state
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastVolumeUpdate = useRef(0);

  const iconColor = useThemeColor({}, 'text');



  // Metro Connection Check
  useEffect(() => {
    if (__DEV__) {
      const host = Constants.expoConfig?.hostUri || 'localhost:8081';
      const metroUrl = `http://${host.split(':')[0]}:8081`;

      const interval: any = setInterval(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Config.METRO_CHECK_TIMEOUT);
        try {
          await fetch(metroUrl, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeoutId);
          if (metroDisconnected) setMetroDisconnected(false);
        } catch (e) {
          clearTimeout(timeoutId);
          if (Platform.OS === 'android') BackHandler.exitApp();
          else setMetroDisconnected(true);
        }
      }, Config.METRO_CHECK_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [metroDisconnected]);

  // AppState Reconnection
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && useWebsockets) {
        console.log("App active, checking connection...");
        // If we are "connected" in state but the socket is actually dead/closed from OS suspension,
        // we need to encourage a reconnect.
        // However, WebSocketService handle logic is "if active, do nothing".
        // We might want to force a heartbeat or just rely on STOMP's keepalive which might be dead.
        // Simplest for now: if connectionStatus is error/connecting, it will auto-retry.
        // If it SAYS connected but is dead, stompjs usually finds out on next heartbeat (20s).
        // To be faster, we could disconnect/reconnect if it's been in background > 1 min, but let's stick to default first.
      }
    });

    return () => {
      subscription.remove();
    };
  }, [useWebsockets, connectionStatus]);

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
    let statusInterval: any;
    let queueInterval: any;

    const setupConnection = async () => {
      // 1. Fetch Config
      try {
        const config = await UkuleleApi.getConfig();
        setUseWebsockets(config.useWebsockets);

        // 2. Decide Mode
        if (config.useWebsockets) {
          // WebSocket Mode
          console.log("Switching to WebSocket mode");
          if (guildId) {
            // Derive WS URL from API URL (strip /api)
            const wsBase = API_BASE_URL.replace(/\/api$/, '');
            WebSocketService.connect(wsBase, () => {
              WebSocketService.subscribe(`/topic/player/${guildId}`, (status: any) => {
                handlePlayerStatusUpdate(status);
              });
            }, (err: any) => console.error("WS Error", err));
          }
        } else {
          // Polling Mode
          console.log("Switching to Polling mode");
          statusInterval = setInterval(async () => {
            if (guildId) {
              await fetchPlayerState();
            } else {
              await loadGuilds();
            }
          }, Config.POLL_INTERVAL_FAST);
        }
      } catch (e) {
        console.warn("Failed to fetch config, defaulting to polling", e);
        // Fallback polling
        statusInterval = setInterval(async () => {
          if (guildId) {
            await fetchPlayerState();
          } else {
            await loadGuilds();
          }
        }, Config.POLL_INTERVAL_FAST);
      }

      // Queue & Security Polling (Always poll these for now, or move them to WS too later)
      queueInterval = setInterval(async () => {
        if (guildId && connectionStatus === 'connected') {
          await fetchQueue();
          await fetchSecurityStats();
        }
      }, Config.POLL_INTERVAL_SLOW);
    };

    setupConnection();

    // Initial load
    if (!guildId) loadGuilds();

    return () => {
      clearInterval(statusInterval);
      clearInterval(queueInterval);
      WebSocketService.disconnect();
    };
  }, [guildId, connectionStatus]);


  const loadGuilds = async () => {
    console.log("DEBUG: loadGuilds started");
    try {
      const guilds = await UkuleleApi.getGuilds();
      console.log("DEBUG: loadGuilds found:", guilds.length);
      if (guilds.length > 0) {
        setGuildId(guilds[0].id);
        setConnectionStatus('connected');
        console.log("DEBUG: calling fetchPlayerState from loadGuilds");
        fetchPlayerState(guilds[0].id);
        fetchQueue();
        fetchSecurityStats();
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
      console.log("DEBUG: fetchPlayerState status:", JSON.stringify(status));
      handlePlayerStatusUpdate(status);
    } catch (e: any) {
      console.error("DEBUG: fetchPlayerState error:", e);
      setConnectionStatus('error');
      let msg = e.message || "Unknown error";
      if (msg.includes("Network request failed") || msg.includes("timeout")) {
        msg = "Server unreachable or offline";
      }
      setErrorMessage(msg);
    }
  };

  const handlePlayerStatusUpdate = (status: any) => {
    console.log("DEBUG: Handling status update", status);
    if (connectionStatus === 'error') {
      setConnectionStatus('connected');
      setErrorMessage(null);
    }

    setIsPlaying(!status.isPaused);

    // Position Sync
    // Only sync if difference is significant (>2s) to avoid jitter fighting local interpolation
    if (status.currentTrack) {
      setDuration(status.currentTrack.duration);
      if (Math.abs(status.currentTrack.position - position) > 2000) {
        setPosition(status.currentTrack.position);
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
    setCurrentTrack(status.currentTrack?.title || null);
    if (status.minVolume !== undefined) {
      setServerStats({
        minVolume: status.minVolume,
        maxVolume: status.maxVolume,
        isReplayGain: status.currentTrack?.isReplayGain || false,
        isReplayGainEnabled: status.isReplayGainEnabled
      });
    }
  };

  const fetchSecurityStats = async () => {
    try {
      const stats = await UkuleleApi.getSecurityStats();
      setUnauthorizedAttempts(stats.unauthorizedAttempts);
    } catch (e) {
      // console.warn("Failed to fetch security stats");
    }
  };

  const fetchQueue = async () => {
    if (!guildId) return;
    try {
      const tracks = await UkuleleApi.getQueue(guildId);
      setQueue(tracks.map((t, i) => ({
        id: t.uri + i,
        title: t.title,
        artist: t.author
      })));
    } catch (e) {
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
      fetchPlayerState();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handlePrev = () => {
    Alert.alert("Previous track not supported");
  };

  const handleVolumeChange = async (newVol: number) => {
    if (!guildId) return;
    const volInt = Math.round(newVol * 1000);
    lastVolumeUpdate.current = Date.now();
    setVolume(newVol);
    try {
      await UkuleleApi.setVolume(guildId, volInt);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSeek = async (pos: number) => {
    if (!guildId) return;
    setPosition(pos); // Optimistic update
    try {
      await UkuleleApi.seek(guildId, pos);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRemoveTrack = (id: string) => {
    Alert.alert("Removing tracks not supported yet via API");
  };

  const handlePlayTrack = (id: string, index: number) => {
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
              fetchPlayerState();
              fetchQueue();
            }, 500);
          }
        }
      ]
    );
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    Alert.alert("Reordering not supported yet");
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
              fetchPlayerState();
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
      fetchPlayerState();
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



  if (metroDisconnected) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#330000', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="cloud-offline" size={64} color="red" />
        <ThemedText type="title" style={{ color: 'red', marginTop: 20 }}>Metro Disconnected</ThemedText>
        <ThemedText style={{ color: '#ffaaaa', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>
          The Expo development server is unreachable.
        </ThemedText>
      </SafeAreaView>
    );
  }

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
                      fetchSecurityStats();
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
          isReplayGain={!!serverStats.isReplayGain} // We need to store this in state
          isReplayGainEnabled={!!serverStats.isReplayGainEnabled}
        />

        <View style={styles.extraControls}>
          <TouchableOpacity onPress={handleStop} style={styles.controlBtn}>
            <Ionicons name="stop-circle-outline" size={32} color="red" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShuffle} style={styles.controlBtn}>
            <Ionicons name="shuffle" size={32} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRepeat} style={styles.controlBtn}>
            <Ionicons name="repeat" size={32} color={repeat ? "green" : iconColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLoop} style={styles.controlBtn}>
            <Ionicons name="infinite" size={32} color={loop ? "green" : iconColor} />
          </TouchableOpacity>
        </View>

        <QueueList
          queue={queue}
          onRemove={handleRemoveTrack}
          onPlay={handlePlayTrack}
          onReorder={handleReorder}
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
    marginBottom: 20,
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
  extraControls: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
    marginTop: -10,
  },
  controlBtn: {
    padding: 5,
  },
});
