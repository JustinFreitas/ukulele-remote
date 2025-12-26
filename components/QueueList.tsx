
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

export type Track = {
    id: string;
    title: string;
    artist?: string;
};

type Props = {
    queue: Track[];
    onRemove: (id: string) => void;
    onPlay: (id: string, index: number) => void;
    onReorder?: (fromIndex: number, toIndex: number) => void;
};

export function QueueList({ queue, onRemove, onPlay, onReorder }: Props) {
    const iconColor = useThemeColor({}, 'text');

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="subtitle" style={styles.header}>Queue</ThemedText>
            {queue.length === 0 ? (
                <ThemedText style={styles.emptyText}>Queue is empty</ThemedText>
            ) : (
                <FlatList
                    data={queue}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                        <ThemedView style={styles.itemContainer}>
                            <View style={styles.reorderControls}>
                                <TouchableOpacity onPress={() => onReorder?.(index, index - 1)} disabled={index === 0} style={styles.reorderBtn}>
                                    <Ionicons name="chevron-up" size={20} color={index === 0 ? '#ccc' : iconColor} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onReorder?.(index, index + 1)} disabled={index === queue.length - 1} style={styles.reorderBtn}>
                                    <Ionicons name="chevron-down" size={20} color={index === queue.length - 1 ? '#ccc' : iconColor} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.trackInfo} onPress={() => onPlay(item.id, index)}>
                                <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                                {item.artist && <ThemedText style={styles.artist}>{item.artist}</ThemedText>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeButton}>
                                <Ionicons name="trash-outline" size={20} color="red" />
                            </TouchableOpacity>
                        </ThemedView>
                    )}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
    },
    header: {
        marginBottom: 10,
        marginTop: 10,
    },
    listContent: {
        paddingBottom: 20,
    },
    emptyText: {
        fontStyle: 'italic',
        opacity: 0.7,
        marginTop: 10,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
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
    artist: {
        fontSize: 12,
        opacity: 0.6,
    },
    removeButton: {
        padding: 5,
    }
});
