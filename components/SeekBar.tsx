import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';

type Props = {
    position: number; // millseconds
    duration: number; // milliseconds
    onSeek: (position: number) => void;
};

export function SeekBar({ position, duration, onSeek }: Props) {
    const iconColor = useThemeColor({}, 'text');
    const trackColor = useThemeColor({ light: '#e0e0e0', dark: '#333333' }, 'text');
    const [barWidth, setBarWidth] = useState(0);

    const handlePress = (e: any) => {
        if (barWidth === 0 || duration === 0) return;
        const x = e.nativeEvent.offsetX !== undefined ? e.nativeEvent.offsetX : e.nativeEvent.locationX;
        if (x === undefined || isNaN(x)) return;
        const percentage = Math.min(1, Math.max(0, x / barWidth));
        onSeek(Math.round(percentage * duration));
    };

    const formatTime = (ms: number) => {
        if (!ms) return "0:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (position / duration) : 0;

    return (
        <View style={styles.container}>
            <Pressable
                style={styles.progressBarContainer}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onPress={handlePress}
            >
                <View style={[styles.progressBarBackground, { backgroundColor: trackColor }]} pointerEvents="none">
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: iconColor }]} pointerEvents="none" />
                </View>
            </Pressable>
            <View style={styles.timeContainer}>
                <ThemedText style={styles.timeText}>{formatTime(position)}</ThemedText>
                <ThemedText style={styles.timeText}>{formatTime(duration)}</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 0,
    },
    progressBarContainer: {
        height: 20,
        justifyContent: 'center',
        ...Platform.select({
            web: {
                cursor: 'pointer'
            }
        })
    } as any,
    progressBarBackground: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -5,
    },
    timeText: {
        fontSize: 12,
        opacity: 0.6,
    }
});
