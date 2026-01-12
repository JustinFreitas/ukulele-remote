
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
    onLoadDefault: () => void;
};

export function QueueList({ queue, onRemove, onPlay, onReorder, onLoadDefault }: Props) {
    const iconColor = useThemeColor({}, 'text');

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="subtitle" style={styles.header}>Queue</ThemedText>
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
                        <ThemedView style={styles.itemContainer}>
                            <TouchableOpacity style={styles.trackInfo} onPress={() => onPlay(item.id, index)}>
                                <ThemedText type="defaultSemiBold" style={styles.title}>{item.title}</ThemedText>
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
