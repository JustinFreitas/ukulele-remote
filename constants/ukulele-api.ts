import { Platform } from 'react-native';

export const API_BASE_URL = process.env.EXPO_PUBLIC_UKULELE_API_URL || (Platform.OS === 'android'
    ? 'http://10.0.2.2:11111/api'
    : 'http://localhost:11111/api');

// In a real app, this would be in a secure storage or context
// For this demo, we use a hardcoded token matching the default or local dev
const API_TOKEN = process.env.EXPO_PUBLIC_UKULELE_API_TOKEN || 'a055b204-4548-46d9-87e6-74627e3b440c';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`
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
}

export interface PlayerStatusDto {
    guildId: string;
    paused: boolean;
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

export const UkuleleApi = {
    getGuilds: async (): Promise<GuildDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/guilds?_t=${Date.now()}`, {
            headers: { ...headers, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (!res.ok) throw new Error('Failed to fetch guilds');
        return res.json();
    },


    getChannels: async (guildId: string): Promise<VoiceChannelDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/channels`, { headers });
        if (!res.ok) throw new Error('Failed to fetch channels');
        return res.json();
    },

    getPlayer: async (guildId: string): Promise<PlayerStatusDto> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch player status');
        return res.json();
    },

    play: async (guildId: string, url: string, channelId?: string, fadeIn?: boolean) => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/play`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url, channelId, fadeIn: fadeIn ? "true" : "false" }),
        });
        if (!res.ok) {
            let errorText = await res.text();
            try {
                const json = JSON.parse(errorText);
                if (json.message) errorText = json.message;
            } catch (e) {}
            throw new Error(errorText || `Failed to play track (${res.status})`);
        }
    },
    // ...

    pause: async (guildId: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/pause`, { method: 'POST', headers });
    },

    resume: async (guildId: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/resume`, { method: 'POST', headers });
    },

    skip: async (guildId: string, index?: number) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/skip`, {
            method: 'POST',
            headers,
            body: index !== undefined ? JSON.stringify({ index }) : undefined
        });
    },

    setVolume: async (guildId: string, volume: number) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/volume`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ volume }),
        });
    },

    stop: async (guildId: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/stop`, { method: 'POST', headers });
    },

    shuffle: async (guildId: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/shuffle`, { method: 'POST', headers });
    },

    setRepeat: async (guildId: string, repeat: boolean) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/repeat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ repeat })
        });
    },

    setLoop: async (guildId: string, loop: boolean) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/loop`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ loop })
        });
    },

    seek: async (guildId: string, position: number) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/seek`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ position })
        });
    },

    say: async (guildId: string, text: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/say`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text })
        });
    },

    move: async (guildId: string, channelId: string) => {
        await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/move`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ channelId })
        });
    },

    getQueue: async (guildId: string): Promise<TrackDto[]> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/player/${guildId}/queue`, { headers });
        if (!res.ok) throw new Error('Failed to fetch queue');
        return res.json();
    },

    getSecurityStats: async (): Promise<{ unauthorizedAttempts: number }> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/security/stats`, { headers });
        if (!res.ok) throw new Error('Failed to fetch security stats');
        return res.json();
    },

    resetSecurityStats: async () => {
        await fetchWithTimeout(`${API_BASE_URL}/security/reset`, { method: 'POST', headers });
    },

    getConfig: async (): Promise<{ useWebsockets: boolean; pollIntervalFast: number; pollIntervalSlow: number }> => {
        const res = await fetchWithTimeout(`${API_BASE_URL}/config`, { headers });
        if (!res.ok) throw new Error('Failed to fetch config');
        return res.json();
    }
};
