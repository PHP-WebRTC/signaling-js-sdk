/**
 * This file is part of the PHP WebRTC package.
 *
 * (c) Amin Yazdanpanah <github@aminyazdanpanah.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RTCSignaling } from './RTCSignaling';

class CloseEvent extends Event {
    code: number;
    reason: string;
    constructor(type: string, options: { code: number; reason?: string }) {
        super(type);
        this.code = options.code;
        this.reason = options.reason || '';
    }
}

class ErrorEvent extends Event {
    error: any;
    constructor(type: string, options: { error: any }) {
        super(type);
        this.error = options.error;
    }
}

(global as any).CloseEvent = CloseEvent;
(global as any).ErrorEvent = ErrorEvent;

jest.mock('protobufjs', () => {
    const mockType = {
        create: jest.fn().mockImplementation(obj => obj),
        encode: jest.fn().mockReturnValue({
            finish: jest.fn().mockReturnValue(new Uint8Array(10))
        }),
        decode: jest.fn().mockImplementation(() => ({})),
        toObject: jest.fn().mockReturnValue({}),
        verify: jest.fn().mockReturnValue(null)
    };

    const mockEnum = {
        values: {
            OFFER: 'OFFER',
            ANSWER: 'ANSWER',
            PRANSWER: 'PRANSWER',
            ROLLBACK: 'ROLLBACK',
            UNKNOWN: 'UNKNOWN'
        }
    };

    return {
        Root: {
            fromJSON: jest.fn().mockReturnValue({
                lookupType: jest.fn().mockReturnValue(mockType),
                lookupEnum: jest.fn().mockReturnValue(mockEnum)
            })
        }
    };
});

jest.mock('../proto/SignalProtocol.json', () => ({}), { virtual: true });

class MockWebSocket {
    readyState = 0;
    binaryType = '';
    url = '';
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    sent: any[] = [];

    constructor(url: string) {
        this.url = url;
        setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) this.onopen(new Event('open'));
        }, 0);
    }

    send(data: any) {
        this.sent.push(data);
    }

    close() {
        this.readyState = 3;
        if (this.onclose) this.onclose(new CloseEvent('close', { code: 1000 }));
    }

    simulateError(error: any) {
        if (this.onerror) {
            this.onerror(new ErrorEvent('error', { error }));
        }
    }

    simulateClose(code = 1000, reason = '') {
        this.readyState = 3;
        if (this.onclose) {
            this.onclose(new CloseEvent('close', { code, reason }));
        }
    }
}

const WEB_SOCKET = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};

let originalWebSocket: any;
let originalConsoleLog: any;
let originalConsoleError: any;
let originalCrypto: any;

describe('RTCSignaling', () => {
    beforeEach(() => {
        originalWebSocket = global.WebSocket;
        (global as any).WebSocket = MockWebSocket;
        (global as any).WebSocket.CONNECTING = WEB_SOCKET.CONNECTING;
        (global as any).WebSocket.OPEN = WEB_SOCKET.OPEN;
        (global as any).WebSocket.CLOSING = WEB_SOCKET.CLOSING;
        (global as any).WebSocket.CLOSED = WEB_SOCKET.CLOSED;

        originalConsoleLog = console.log;
        originalConsoleError = console.error;
        console.log = jest.fn();
        console.error = jest.fn();

        originalCrypto = global.crypto;

        jest.clearAllMocks();
    });

    afterEach(() => {
        if ((global as any).WebSocket) {
            const ws = (global as any).WebSocket;
            if (ws.prototype && ws.prototype.close) {
                ws.prototype.close();
            }
        }

        global.WebSocket = originalWebSocket;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    });

    it('should initialize with the provided URL and ID', () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        expect((signaling as any).serverUrl).toBe('ws://test:8080');
        expect((signaling as any).id).toBe('test-id');
    });

    it('should use empty string as default ID if none provided', () => {
        const signaling = new RTCSignaling('ws://test:8080', null);
        expect((signaling as any).id).toBe('');
    });

    it('should initialize WebSocket with correct URL', () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        expect((signaling as any).socket.url).toBe('ws://test:8080');
    });

    it('should set WebSocket binaryType to arraybuffer', () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        expect((signaling as any).socket.binaryType).toBe('arraybuffer');
    });

    it('should send SDP message correctly', async () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        (signaling as any).socket.readyState = WEB_SOCKET.OPEN;

        const sdp = {
            type: 'offer',
            sdp: 'test-sdp'
        };

        await signaling.sendSDP(sdp);
        expect((signaling as any).socket.sent.length).toBe(1);
    });

    it('should close connection when close method is called', () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        const closeSpy = jest.spyOn((signaling as any).socket, 'close');
        signaling.close();
        expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle WebSocket errors without crashing', () => {
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        (signaling as any).socket.simulateError(new Error('Test error'));
        expect(console.error).toHaveBeenCalled();
    });

    it('should attempt reconnect on abnormal close', () => {
        jest.useFakeTimers();
        const signaling = new RTCSignaling('ws://test:8080', 'test-id');
        const attemptReconnectSpy = jest.spyOn(signaling as any, 'attemptReconnect');
        (signaling as any).socket.simulateClose(1006, 'Abnormal closure');
        expect(attemptReconnectSpy).toHaveBeenCalled();
        jest.useRealTimers();
    });
});

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});
