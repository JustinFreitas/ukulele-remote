
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';

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
    onAddTrack?: (url: string) => Promise<void>;
};

export function QueueList({ queue, onRemove, onPlay, onReorder, onLoadDefault, onAddTrack }: Props) {
    const [addUrl, setAddUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);

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

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="subtitle" style={styles.header}>Queue</ThemedText>
            
            <View style={styles.addTrackContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Search or Paste URL..."
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
