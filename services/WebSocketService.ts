import { Client } from '@stomp/stompjs';
import { TextDecoder, TextEncoder } from 'text-encoding';

// Polyfill for React Native
if (typeof global.TextEncoder === 'undefined') {
    (global as any).TextEncoder = TextEncoder;
    (global as any).TextDecoder = TextDecoder;
}

class WebSocketService {
    private client: Client | null = null;
    private subscriptions: { [key: string]: any } = {};

    connect(url: string, onConnect: () => void, onError: (err: any) => void) {
        if (this.client && this.client.active) {
            // console.log('[WS] Already connected, skipping init');
            onConnect();
            return;
        }

        // Replace http/https with ws/wss
        const wsUrl = url.replace(/^http/, 'ws') + '/ws';
        // console.log('[WS] Connecting to:', wsUrl);

        this.client = new Client({
            brokerURL: wsUrl,
            reconnectDelay: 5000,
            heartbeatIncoming: 20000,
            heartbeatOutgoing: 20000,
            // For React Native, we force WebSocket implementation if needed, 
            // but stompjs handles it well with standard API.
            // If we needed SockJS we would use webSocketFactory
            onConnect: () => {
                // console.log('[WS] Connected');
                onConnect();
            },
            onStompError: (frame) => {
                console.error('[WS] Broker reported error: ' + frame.headers['message']);
                onError(frame.headers['message']);
            },
            onWebSocketError: (event) => {
                console.error('[WS] WebSocket error:', event);
            }
        });

        this.client.activate();
    }

    subscribe(topic: string, callback: (data: any) => void) {
        if (!this.client || !this.client.active) {
            console.warn('[WS] Cannot subscribe, client not active');
            return;
        }

        if (this.subscriptions[topic]) {
            // Already subscribed
            return;
        }

        // console.log('[WS] Subscribing to:', topic);
        this.subscriptions[topic] = this.client.subscribe(topic, (message) => {
            try {
                const body = JSON.parse(message.body);
                callback(body);
            } catch (e) {
                console.error('[WS] Failed to parse message:', e);
            }
        });
    }

    unsubscribe(topic: string) {
        if (this.subscriptions[topic]) {
            this.subscriptions[topic].unsubscribe();
            delete this.subscriptions[topic];
        }
    }

    disconnect() {
        if (this.client) {
            this.client.deactivate();
            this.client = null;
            this.subscriptions = {};
        }
    }
}

export default new WebSocketService();
