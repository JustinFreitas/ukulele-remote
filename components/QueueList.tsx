import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CacheStatsDto, TrackCacheState } from '@/constants/ukulele-api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';

export type Track = {
    id: string;
    title: string;
    artist?: string;
    cacheState?: TrackCacheState;
};

type Props = {
    queue: Track[];
    onRemove: (id: string) => void;
    onPlay: (id: string, index: number) => void;
    onReorder?: (fromIndex: number, toIndex: number) => void;
    onLoadDefault: () => void;
    onAddTrack?: (url: string) => Promise<void>;
    cacheStats?: CacheStatsDto | null;
    onClearCache?: () => Promise<void> | void;
};

function formatBytes(bytes: number): string {
    const safe = Math.max(0, bytes || 0);
    if (safe >= 1024 * 1024 * 1024) {
        return `${(safe / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (safe >= 1024 * 1024) {
        return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (safe >= 1024) {
        return `${(safe / 1024).toFixed(1)} KB`;
    }
    return `${safe} B`;
}

export const QueueList = React.memo(function QueueList({
    queue,
    onRemove,
    onPlay,
    onReorder,
    onLoadDefault,
    onAddTrack,
    cacheStats,
    onClearCache,
}: Props) {
    const [addUrl, setAddUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const inputBg = useThemeColor({ light: '#f0f0f0', dark: '#2c2c2e' }, 'background');
    const inputText = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const borderThemeColor = useThemeColor({ light: '#ccc', dark: '#3e3e42' }, 'icon');
    const reorderIconColor = useThemeColor({}, 'icon');

    const handleAdd = async () => {
        if (!addUrl.trim() || !onAddTrack) return;
        setIsAdding(true);
        try {
            await onAddTrack(addUrl.trim());
            setAddUrl('');
        } catch (e: any) {
            Alert.alert("Failed to queue", e.message);
        } finally {
            setIsAdding(false);
        }
    };

    const showCachePill = !!(
        cacheStats?.enabled &&
        (cacheStats.queuedLocalCount > 0 || cacheStats.totalBytes > 0)
    );

    const renderRowBadge = (state?: TrackCacheState) => {
        if (!state) return null;
        const cfg =
            state === 'MEMORY'
                ? { text: 'RAM', bg: '#1976D2' }
                : state === 'PREFETCHING'
                    ? { text: '⏳', bg: '#F57C00' }
                    : { text: 'DISK', bg: '#616161' };
        return (
            <View style={[styles.rowCacheBadge, { backgroundColor: cfg.bg }]}>
                <ThemedText style={styles.rowCacheBadgeText}>{cfg.text}</ThemedText>
            </View>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerRow}>
                <ThemedText type="subtitle" style={styles.header}>Queue</ThemedText>
                {showCachePill && cacheStats && (
                    <View style={styles.cacheHeaderGroup}>
                        <View style={styles.cachePill} testID="queue-cache-pill">
                            <ThemedText style={styles.cachePillText}>
                                {cacheStats.queuedLocalCount > 0
                                    ? `RAM ${cacheStats.queuedInMemoryCount}/${cacheStats.queuedLocalCount} • ${formatBytes(cacheStats.totalBytes)} / ${formatBytes(cacheStats.maxBytes)}`
                                    : `LRU ${formatBytes(cacheStats.lruBytes)} / ${formatBytes(cacheStats.maxBytes)}`}
                            </ThemedText>
                        </View>
                        {cacheStats.lruBytes > 0 && onClearCache && (
                            <TouchableOpacity
                                style={styles.clearCacheBtn}
                                onPress={() => void onClearCache()}
                                testID="clear-lru-button"
                            >
                                <ThemedText style={styles.clearCacheBtnText}>Clear LRU</ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            <View style={styles.addTrackContainer}>
                <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: inputText }]}
                    placeholder="Paste URL, file, or folder path..."
                    placeholderTextColor="#888"
                    value={addUrl}
                    onChangeText={setAddUrl}
                    onSubmitEditing={handleAdd}
                    returnKeyType="search"
                    editable={!isAdding}
                />
                <TouchableOpacity
                    style={[styles.addBtn, (!addUrl.trim() || isAdding) && { opacity: 0.5 }]}
                    onPress={handleAdd}
                    disabled={!addUrl.trim() || isAdding}
                >
                    {isAdding ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Ionicons name="add" size={20} color="white" />
                    )}
                </TouchableOpacity>
            </View>

            {queue.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 15, marginTop: 20 }}>
                    <ThemedText style={styles.emptyText}>Queue is empty</ThemedText>
                    <TouchableOpacity onPress={onLoadDefault} style={styles.loadDefaultBtn}>
                        <Ionicons name="library-outline" size={20} color="white" />
                        <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Load Default</ThemedText>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={queue}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                        <ThemedView style={[styles.itemContainer, { borderBottomColor: borderThemeColor }]}>
                            {onReorder && (
                                <View style={styles.reorderControls}>
                                    <TouchableOpacity
                                        style={[styles.reorderBtn, index === 0 && { opacity: 0.2 }]}
                                        disabled={index === 0}
                                        onPress={() => onReorder(index, index - 1)}
                                    >
                                        <Ionicons name="chevron-up" size={16} color={reorderIconColor} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.reorderBtn, index === queue.length - 1 && { opacity: 0.2 }]}
                                        disabled={index === queue.length - 1}
                                        onPress={() => onReorder(index, index + 1)}
                                    >
                                        <Ionicons name="chevron-down" size={16} color={reorderIconColor} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity style={styles.trackInfo} onPress={() => onPlay(item.id, index)}>
                                <ThemedText type="defaultSemiBold" style={styles.title}>{item.title}</ThemedText>
                                {item.artist ? (
                                    <ThemedText style={styles.artist}>{item.artist}</ThemedText>
                                ) : null}
                            </TouchableOpacity>
                            {renderRowBadge(item.cacheState)}
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => onRemove(item.id)}
                            >
                                <Ionicons name="trash-outline" size={18} color="red" />
                            </TouchableOpacity>
                        </ThemedView>
                    )}
                />
            )}
        </ThemedView>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
    },
    headerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 10,
        marginTop: 10,
    },
    header: {
        marginBottom: 0,
        marginTop: 0,
    },
    cacheHeaderGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cachePill: {
        backgroundColor: '#1976D2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    cachePillText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '600',
    },
    clearCacheBtn: {
        backgroundColor: '#555',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    clearCacheBtnText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 20,
    },
    emptyText: {
        fontStyle: 'italic',
        opacity: 0.7,
        marginTop: 10,
    },
    addTrackContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 8,
        color: '#000',
    },
    addBtn: {
        backgroundColor: '#2196F3',
        width: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
        gap: 10,
    },
    reorderControls: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 5,
    },
    reorderBtn: {
        padding: 2,
    },
    trackInfo: {
        flex: 1,
    },
    title: {
        fontSize: 13,
    },
    artist: {
        fontSize: 11,
        opacity: 0.6,
    },
    rowCacheBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    rowCacheBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    removeButton: {
        padding: 5,
    },
    loadDefaultBtn: {
        flexDirection: 'row',
        backgroundColor: '#2196F3',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
        gap: 8
    }
});
