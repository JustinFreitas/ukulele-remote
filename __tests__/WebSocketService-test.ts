import WebSocketService from '../services/WebSocketService';
import { Client } from '@stomp/stompjs';

jest.mock('@stomp/stompjs');

describe('WebSocketService', () => {
    let mockClientInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClientInstance = {
            active: false,
            connected: false,
            activate: jest.fn(function (this: any) {
                this.active = true;
            }),
            deactivate: jest.fn(function (this: any) {
                this.active = false;
                this.connected = false;
            }),
            forceDisconnect: jest.fn(),
            subscribe: jest.fn(),
        };
        (Client as unknown as jest.Mock).mockImplementation((config: any) => {
            Object.assign(mockClientInstance, config);
            return mockClientInstance;
        });
    });

    afterEach(() => {
        WebSocketService.disconnect();
    });

    it('initializes STOMP client with wsUrl and connectHeaders, then activates', () => {
        const onConnect = jest.fn();
        const onDisconnect = jest.fn();
        const onError = jest.fn();

        WebSocketService.connect('http://localhost:8080/api', onConnect, onDisconnect, onError);

        expect(Client).toHaveBeenCalledWith(expect.objectContaining({
            brokerURL: 'ws://localhost:8080/api/ws',
            reconnectDelay: 5000,
            heartbeatIncoming: 20000,
            heartbeatOutgoing: 20000,
        }));
        expect(mockClientInstance.activate).toHaveBeenCalled();
    });

    it('subscribes to topic and parses incoming JSON payload', () => {
        WebSocketService.connect('http://localhost:8080', jest.fn(), jest.fn(), jest.fn());

        let messageHandler: ((msg: any) => void) | undefined;
        mockClientInstance.subscribe.mockImplementation((topic: string, cb: any) => {
            messageHandler = cb;
            return { unsubscribe: jest.fn() };
        });

        const callback = jest.fn();
        WebSocketService.subscribe('/topic/player/123', callback);

        expect(mockClientInstance.subscribe).toHaveBeenCalledWith('/topic/player/123', expect.any(Function));

        messageHandler!({ body: JSON.stringify({ isPaused: false, volume: 100 }) });
        expect(callback).toHaveBeenCalledWith({ isPaused: false, volume: 100 });
    });

    it('unsubscribes and cleans up subscription', () => {
        WebSocketService.connect('http://localhost:8080', jest.fn(), jest.fn(), jest.fn());

        const mockSub = { unsubscribe: jest.fn() };
        mockClientInstance.subscribe.mockReturnValue(mockSub);

        WebSocketService.subscribe('/topic/player/456', jest.fn());
        WebSocketService.unsubscribe('/topic/player/456');

        expect(mockSub.unsubscribe).toHaveBeenCalled();
    });

    it('reports isConnected based on client state', () => {
        expect(WebSocketService.isConnected()).toBe(false);

        WebSocketService.connect('http://localhost:8080', jest.fn(), jest.fn(), jest.fn());
        mockClientInstance.connected = true;

        expect(WebSocketService.isConnected()).toBe(true);
    });
});
