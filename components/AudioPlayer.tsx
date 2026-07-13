import { SeekBar } from '@/components/SeekBar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Config } from '@/constants/Config';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Pressable, Platform } from 'react-native';

type Props = {
    isPlaying: boolean;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    volume: number;
    onVolumeChange: (newVolume: number) => void;
    currentTrack: string | null;
    minVolume?: number;
    maxVolume?: number;
    position: number;
    duration: number;
    onSeek: (position: number) => void;
    isReplayGain?: boolean;
    replayGainDb?: number | null;
    isReplayGainEnabled?: boolean;
    hasNext?: boolean;
    onFadeIn: () => void;
    onFadeOut: () => void;
    onStop: () => void;
    onShuffle: () => void;
    onToggleRepeat: () => void;
    onToggleLoop: () => void;
    repeat: boolean;
    loop: boolean;
    autoFadeIn: boolean;
};

export function AudioPlayer({ isPlaying, onPlayPause, onNext, onPrev, volume, onVolumeChange, currentTrack, minVolume, maxVolume, position, duration, onSeek, isReplayGain, replayGainDb, isReplayGainEnabled, hasNext = true, onFadeIn, onFadeOut, onStop, onShuffle, onToggleRepeat, onToggleLoop, repeat, loop, autoFadeIn }: Props) {
    const iconColor = useThemeColor({}, 'text');
    const trackColor = useThemeColor({ light: '#e0e0e0', dark: '#333333' }, 'text');
    const buttonBgColor = useThemeColor({ light: '#eee', dark: '#2c2c2e' }, 'background');
    const buttonTextColor = useThemeColor({ light: 'black', dark: 'white' }, 'text');
    const fadeOutBgColor = useThemeColor({ light: '#ffebee', dark: '#3a1f21' }, 'background');
    const defaultFadeInBgColor = useThemeColor({ light: '#e8f5e9', dark: '#1c3a21' }, 'background');
    const fadeInBgColor = autoFadeIn ? '#4CAF50' : defaultFadeInBgColor;
    const fadeOutIconColor = useThemeColor({ light: 'black', dark: '#ff8a80' }, 'text');
    const defaultFadeInIconColor = useThemeColor({ light: 'black', dark: '#81c784' }, 'text');
    const fadeInIconColor = autoFadeIn ? 'white' : defaultFadeInIconColor;
    const [barWidth, setBarWidth] = React.useState(0);

    // Dynamic Volume Steps
    // If range is small (e.g. 0-30), 1% change might do nothing.
    // Calculate optimal step size to change real volume by at least 1.
    // 100% / Range = Step percentage needed.
    // e.g. 100/30 = 3.33% -> round up to 4?
    let stepSmall = Config.VOL_STEP_SMALL;
    let stepMedium = Config.VOL_STEP_MEDIUM;
    let stepLarge = Config.VOL_STEP_LARGE;

    if (maxVolume !== undefined && minVolume !== undefined) {
        const range = maxVolume - minVolume;
        if (range > 0) {
            const optimal = Math.ceil(100 / range);
            stepSmall = Math.max(optimal, 1); // At least 1%
            stepMedium = stepSmall * 3; // 3x step
            stepLarge = stepSmall * 5;  // 5x step

            // Cap at reasonable values if range is tiny
            if (stepMedium > 25) stepMedium = 25;
            if (stepLarge > 50) stepLarge = 50;
        }
    }

    const handleVolumePress = (e: any) => {
        if (barWidth === 0) return;
        const x = e.nativeEvent.locationX;
        const newVolume = Math.min(1, Math.max(0, x / barWidth));
        onVolumeChange(newVolume);
    };

    return (
        <ThemedView style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                {isReplayGainEnabled && currentTrack && (
                    <View style={{
                        backgroundColor: isReplayGain ? '#4CAF50' : '#888',
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        marginRight: 6,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 3,
                        opacity: isReplayGain ? 1 : 0.5
                    }}>
                        <ThemedText style={{ fontSize: 11, lineHeight: 14, fontWeight: 'bold', color: 'white', textAlign: 'center', includeFontPadding: false }}>RG</ThemedText>
                    </View>
                )}
                {isReplayGainEnabled && currentTrack && replayGainDb != null && (
                    <ThemedText style={{ fontSize: 12, opacity: 0.7, marginRight: 6, marginTop: 3 }}>
                        {`${replayGainDb >= 0 ? '+' : ''}${replayGainDb.toFixed(1)} dB`}
                    </ThemedText>
                )}
                <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                    {currentTrack || 'No Track Playing'}
                </ThemedText>
            </View>

            <SeekBar position={position} duration={duration} onSeek={onSeek} />

            <View style={styles.controls}>
                <TouchableOpacity onPress={onPrev} style={{ opacity: 0.3 }} testID="prev-button">
                    <Ionicons name="play-skip-back" size={32} color={iconColor} />
                </TouchableOpacity>

                <TouchableOpacity onPress={onPlayPause} style={styles.playButton} testID="play-pause-button">
                    <Ionicons name={isPlaying ? "pause" : "play"} size={48} color={iconColor} />
                </TouchableOpacity>

                <TouchableOpacity onPress={onNext} disabled={!hasNext} style={{ opacity: hasNext ? 1.0 : 0.3 }} testID="next-button">
                    <Ionicons name="play-skip-forward" size={32} color={iconColor} />
                </TouchableOpacity>
            </View>

            <View style={styles.volumeContainer}>
                <Ionicons name="volume-low" size={24} color={iconColor} />
                <Pressable
                    style={[styles.volumeBar, { height: 20, justifyContent: 'center' }]} // Increased height for touch target
                    onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                    onPress={handleVolumePress}
                >
                    <View style={{ height: 5, backgroundColor: trackColor, borderRadius: 2, overflow: 'hidden', width: '100%' }} pointerEvents="none">
                        <View style={[styles.volumeFill, { width: `${volume * 100}%`, backgroundColor: iconColor }]} pointerEvents="none" />
                    </View>
                </Pressable>
                <View style={{ width: 45, alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText style={{ textAlign: 'center' }}>
                        {Math.round(volume * 100)}%
                    </ThemedText>
                </View>
            </View>

            <View style={styles.volumeControls}>
                {/* 1. -Large / FadeOut */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.max(0, volume - stepLarge / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ fontWeight: 'bold', color: buttonTextColor }}>-{stepLarge}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onFadeOut} style={[styles.volButton, { backgroundColor: fadeOutBgColor, width: '100%', paddingHorizontal: 0 }]}>
                        <Ionicons name="trending-down" size={16} color={fadeOutIconColor} />
                    </TouchableOpacity>
                </View>

                {/* 2. -Medium / Stop */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.max(0, volume - stepMedium / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ fontWeight: 'bold', color: buttonTextColor }}>-{stepMedium}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onStop} style={{ padding: 5 }}>
                        <Ionicons name="stop" size={24} color="red" />
                    </TouchableOpacity>
                </View>

                {/* 3. -Small / Shuffle */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.max(0, volume - stepSmall / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ color: buttonTextColor }}>-{stepSmall}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onShuffle} style={{ padding: 5 }}>
                        <Ionicons name="shuffle" size={24} color={iconColor} />
                    </TouchableOpacity>
                </View>

                {/* 5. +Small / Repeat */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.min(1, volume + stepSmall / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ color: buttonTextColor }}>+{stepSmall}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onToggleRepeat} style={{ padding: 5 }}>
                        <Ionicons name="repeat" size={24} color={repeat ? "green" : iconColor} />
                    </TouchableOpacity>
                </View>

                {/* 6. +Medium / Loop */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.min(1, volume + stepMedium / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ fontWeight: 'bold', color: buttonTextColor }}>+{stepMedium}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onToggleLoop} style={{ padding: 5 }}>
                        <Ionicons name="infinite" size={24} color={loop ? "green" : iconColor} />
                    </TouchableOpacity>
                </View>

                {/* 7. +Large / FadeIn */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity onPress={() => onVolumeChange(Math.min(1, volume + stepLarge / 100))} style={[styles.volButton, { backgroundColor: buttonBgColor }]}>
                        <ThemedText style={{ fontWeight: 'bold', color: buttonTextColor }}>+{stepLarge}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onFadeIn} style={[styles.volButton, { backgroundColor: fadeInBgColor, width: '100%', paddingHorizontal: 0 }]}>
                        <Ionicons name="trending-up" size={16} color={fadeInIconColor} />
                    </TouchableOpacity>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 0, // Reduced padding since no border
        width: '100%',
        marginBottom: 20,
    },

    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center controls
        gap: 30,
        marginBottom: 20,
        marginTop: -10,
    },
    playButton: {
        padding: 10,
    },
    volumeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        paddingHorizontal: 10,
    },
    volumeBar: {
        flex: 1,
        ...Platform.select({
            web: {
                cursor: 'pointer'
            }
        })
    } as any,
    volumeFill: {
        height: '100%',
    },
    volumeControls: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 15,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    volButton: {
        padding: 8,
        paddingHorizontal: 12,
        backgroundColor: '#eee',
        borderRadius: 5,
        minWidth: 55,
        alignItems: 'center',
        height: 35,
        justifyContent: 'center'
    },
    controlColumn: {
        alignItems: 'center',
        gap: 8,
        width: 55
    },
    volLabel: {
        fontWeight: 'bold',
        opacity: 0.5,
        fontSize: 12,
        marginHorizontal: 5
    }
});
