import { Platform } from 'react-native';

export const API_BASE_URL = process.env.EXPO_PUBLIC_UKULELE_API_URL || (Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/api'
    : 'http://localhost:8080/api');

// The token is bundled into the client at build time via EXPO_PUBLIC_*, so it
// is not secret. This is intended for trusted/LAN use of the remote API.
const API_TOKEN = process.env.EXPO_PUBLIC_UKULELE_API_TOKEN;

// Disable caching on every request so player/queue state never goes stale.
const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

export interface GuildDto {
    id: string;
    name: string;
    isPlaying: boolean;
}


export interface TrackDto {
    title: string;
    author: string;
    uri: string;
    duration: number;
    position: number;
    isReplayGain: boolean;
    replayGainDb: number | null;
}

export interface PlayerStatusDto {
    guildId: string;
    isPaused: boolean;
    volume: number;
    repeatTrack: boolean;
    queueLooping: boolean;
    currentTrack: TrackDto | null;
    remainingDuration: number;
    minVolume: number;
    maxVolume: number;
    isReplayGainEnabled: boolean;
    queueSize: number;
    channelId?: string;
}

// ...
export interface VoiceChannelDto {
    id: string;
    name: string;
}

// ... 

const fetchWithTimeout = async (resource: string, options: RequestInit = {}) => {
    const { timeout = 2000 } = options as any;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') {
            throw new Error('Server unreachable (timeout)');
        }
        throw e;
    }
};

const ensureOk = async (res: Response, defaultMsg: string) => {
    if (!res.ok) {
        let errorText = '';
        try {
            errorText = await res.text();
            const json = JSON.parse(errorText);
            if (json.message) errorText = json.message;
        } catch {}
        throw new Error(errorText || `${defaultMsg} (${res.status})`);
    }
    return res;
};

export const UkuleleApi = {
    getGuilds: async (): Promise<GuildDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/guilds?_t=${Date.now()}`, { headers });
        if (!res.ok) {
            throw new Error(`Failed to fetch guilds (Status: ${res.status})`);
        }
        return res.json();
    },

    getChannels: async (guildId: string): Promise<VoiceChannelDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/channels`, { headers });
        await ensureOk(res, 'Failed to fetch channels');
        return res.json();
    },

    getPlayer: async (guildId: string): Promise<PlayerStatusDto> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}`, { headers });
        await ensureOk(res, 'Failed to fetch player status');
        return res.json();
    },

    play: async (guildId: string, url: string, channelId?: string, fadeIn?: boolean) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/play`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url, channelId, fadeIn: !!fadeIn }),
        });
        await ensureOk(res, 'Failed to play track');
    },

    pause: async (guildId: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/pause`, { method: 'POST', headers });
        await ensureOk(res, 'Failed to pause');
    },

    resume: async (guildId: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/resume`, { method: 'POST', headers });
        await ensureOk(res, 'Failed to resume');
    },

    skip: async (guildId: string, index?: number) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/skip`, {
            method: 'POST',
            headers,
            body: index !== undefined ? JSON.stringify({ index }) : undefined
        });
        await ensureOk(res, 'Failed to skip');
    },

    setVolume: async (guildId: string, volume: number) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/volume`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ volume }),
        });
        await ensureOk(res, 'Failed to set volume');
    },

    stop: async (guildId: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/stop`, { method: 'POST', headers });
        await ensureOk(res, 'Failed to stop');
    },

    shuffle: async (guildId: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/shuffle`, { method: 'POST', headers });
        await ensureOk(res, 'Failed to shuffle');
    },

    setRepeat: async (guildId: string, repeat: boolean) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/repeat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ repeat })
        });
        await ensureOk(res, 'Failed to set repeat');
    },

    setLoop: async (guildId: string, loop: boolean) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/loop`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ loop })
        });
        await ensureOk(res, 'Failed to set loop');
    },

    seek: async (guildId: string, position: number) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/seek`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ position })
        });
        await ensureOk(res, 'Failed to seek');
    },

    say: async (guildId: string, text: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/say`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text })
        });
        await ensureOk(res, 'Failed to say');
    },

    move: async (guildId: string, channelId: string) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/move`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ channelId })
        });
        await ensureOk(res, 'Failed to move');
    },

    getQueue: async (guildId: string): Promise<TrackDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/queue`, { headers });
        await ensureOk(res, 'Failed to fetch queue');
        return res.json();
    },

    removeTrack: async (guildId: string, index: number) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/remove`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ index })
        });
        await ensureOk(res, 'Failed to remove track');
    },

    reorderQueue: async (guildId: string, fromIndex: number, toIndex: number) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/reorder`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ fromIndex, toIndex })
        });
        await ensureOk(res, 'Failed to reorder queue');
    },

    getSecurityStats: async (): Promise<{ unauthorizedAttempts: number }> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/security/stats`, { headers });
        await ensureOk(res, 'Failed to fetch security stats');
        return res.json();
    },

    resetSecurityStats: async () => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/security/reset`, { method: 'POST', headers });
        await ensureOk(res, 'Failed to reset security stats');
    },

    getConfig: async (): Promise<{ useWebsockets: boolean; pollIntervalFast: number; pollIntervalSlow: number }> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/config`, { headers });
        await ensureOk(res, 'Failed to fetch config');
        return res.json();
    }
};
