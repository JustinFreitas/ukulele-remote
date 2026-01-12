
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export type Channel = {
    id: string;
    name: string;
};

type Props = {
    channels: Channel[];
    selectedChannelId: string | null;
    onSelectChannel: (channelId: string) => void;
};

export function VoiceChannelSelector({ channels, selectedChannelId, onSelectChannel }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const borderColor = useThemeColor({}, 'icon');
    const backgroundColor = useThemeColor({ light: '#f0f0f0', dark: '#1c1c1e' }, 'background');
    const selectedName = channels.find(c => c.id === selectedChannelId)?.name || "Select Voice Channel";

    return (
        <>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.selector, { borderColor }]}>
                <Ionicons name="mic-outline" size={20} color={borderColor} />
                <ThemedText style={{ flex: 1 }} numberOfLines={1}>{selectedName}</ThemedText>
                <Ionicons name="chevron-down" size={20} color={borderColor} />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={[styles.modalContent, { backgroundColor }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Select Channel</ThemedText>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={borderColor} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.channelList}>
                            <TouchableOpacity
                                key="owner"
                                style={[
                                    styles.channelItem,
                                    selectedChannelId === "owner" && styles.selectedItem
                                ]}
                                onPress={() => {
                                    onSelectChannel("owner");
                                    setModalVisible(false);
                                }}
                            >
                                <Ionicons
                                    name={selectedChannelId === "owner" ? "radio-button-on" : "radio-button-off"}
                                    size={20}
                                    color={borderColor}
                                />
                                <ThemedText style={{ fontStyle: 'italic' }}>Follow My Channel</ThemedText>
                            </TouchableOpacity>
                            {channels.map(channel => (
                                <TouchableOpacity
                                    key={channel.id}
                                    style={[
                                        styles.channelItem,
                                        channel.id === selectedChannelId && styles.selectedItem
                                    ]}
                                    onPress={() => {
                                        onSelectChannel(channel.id);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Ionicons
                                        name={channel.id === selectedChannelId ? "radio-button-on" : "radio-button-off"}
                                        size={20}
                                        color={borderColor}
                                    />
                                    <ThemedText>{channel.name}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        marginHorizontal: 20,
        marginTop: 2,
        marginBottom: 20,
        borderWidth: 1,
        borderRadius: 8,
        gap: 10,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '60%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    channelList: {
        marginBottom: 20,
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
        gap: 12,
    },
    selectedItem: {
        backgroundColor: 'rgba(128,128,128,0.1)',
    }
});
