/**
 * This file is part of the PHP WebRTC package.
 *
 * (c) Amin Yazdanpanah <github@aminyazdanpanah.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import * as protobuf from "protobufjs";
import protoJson from "../proto/SignalProtocol.json";

export class RTCSignaling {
    private socket!: WebSocket;
    private serverUrl: string;
    private id: string;
    private pendingRequests: Map<string, (data: RTCSessionDescriptionInit) => void> = new Map();
    private onMessageCallback?: (message: RTCSessionDescriptionInit) => void;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private protoRoot!: protobuf.Root;
    private SignalMessage!: protobuf.Type;
    private RequestMessage!: protobuf.Type;
    private ResponseMessage!: protobuf.Type;
    private WebSocketMessage!: protobuf.Type;
    private SignalType!: protobuf.Enum;

    constructor(serverUrl: string | null | undefined, id: string | null | undefined) {
        this.serverUrl = serverUrl ?? "ws://" + window.location.hostname + ":5000/signaling";
        this.id = id ?? "";

        this.initialize();
    }

    private initialize() {
        try {
            this.initializeProtobuf();
            this.socket = this.createWebSocketConnection();
        }catch (error) {
            console.error('[RTCSignaling] Failed to initialize protobuf:', error);
            throw error;
        }
    }

    private initializeProtobuf(): void {
        try {
            this.protoRoot = protobuf.Root.fromJSON(protoJson);

            this.SignalMessage = this.protoRoot.lookupType('webrtcsignaler.SignalMessage');
            this.RequestMessage = this.protoRoot.lookupType('webrtcsignaler.RequestMessage');
            this.ResponseMessage = this.protoRoot.lookupType('webrtcsignaler.ResponseMessage');
            this.WebSocketMessage = this.protoRoot.lookupType('webrtcsignaler.WebSocketMessage');
            this.SignalType = this.protoRoot.lookupEnum('webrtcsignaler.SignalType');

            console.log('[RTCSignaling] Protocol Buffers initialized successfully');
        } catch (error) {
            console.error('[RTCSignaling] Failed to load proto file:', error);
            throw error;
        }
    }

    private createWebSocketConnection(): WebSocket {

        const socket = new WebSocket(this.serverUrl);

        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
            console.log('[RTCSignaling] WebSocket connection opened.');
            this.reconnectAttempts = 0;
        };

        socket.onclose = (event) => {
            console.log('[RTCSignaling] WebSocket connection closed.', event.code, event.reason);
            if (event.code !== 1000 && event.code !== 1001) {
                this.attemptReconnect();
            }
        };

        socket.onerror = (error) => {
            console.error('[RTCSignaling] WebSocket error:', error);
        };

        socket.onmessage = (event) => {
            console.log(event.data)
            try {
                const buffer = event.data as ArrayBuffer;
                const uint8Array = new Uint8Array(buffer);

                const decodedWrapper = this.WebSocketMessage.decode(uint8Array);
                const messageObj = this.WebSocketMessage.toObject(decodedWrapper, {
                    enums: String,
                    longs: String,
                    defaults: true
                });

                if (messageObj.response && messageObj.response.messageId &&
                    this.pendingRequests.has(messageObj.response.messageId)) {
                    const resolve = this.pendingRequests.get(messageObj.response.messageId)!;

                    if (messageObj.response.statusCode && String(messageObj.response.statusCode).startsWith('2')) {
                        const signalType = messageObj.response.response.type === 'OFFER' ? 'offer' : 'answer';

                        const signalMessage: RTCSessionDescriptionInit = {
                            sdp: messageObj.response.response.sdp,
                            type: signalType
                        };

                        resolve(signalMessage);
                    }

                    this.pendingRequests.delete(messageObj.response.messageId);
                    return;
                }

                if (messageObj.signal) {
                    const signalType = messageObj.signal.type.toLowerCase();
                    const signalMessage: RTCSessionDescriptionInit = {
                        sdp: messageObj.signal.sdp,
                        type: signalType
                    };

                    if (this.onMessageCallback) {
                        this.onMessageCallback(signalMessage);
                    }
                }
            } catch (error) {
                console.error('[RTCSignaling] Failed to parse incoming message:', error);
            }
        };

        return socket;
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[RTCSignaling] Maximum reconnection attempts reached.');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[RTCSignaling] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
            if (this.socket.readyState === WebSocket.CLOSED) {
                console.log('[RTCSignaling] Reconnecting...');
                this.socket = this.createWebSocketConnection();
            }
        }, delay);
    }

    private async ensureConnected(): Promise<void> {
        if (!this.WebSocketMessage) {
            this.initializeProtobuf();
        }

        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                resolve();
            } else if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
                this.socket.addEventListener('open', () => resolve(), {once: true});
                this.socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {once: true});
            } else {
                this.socket = this.createWebSocketConnection();
                this.socket.addEventListener('open', () => resolve(), {once: true});
                this.socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {once: true});
            }
        });
    }

    public async sendSDP(description: RTCSessionDescriptionInit): Promise<void> {
        try {
            await this.ensureConnected();
            const signalTypeValue = this.getSignalType(description.type)

            const message = {
                sdp: description.sdp,
                type: signalTypeValue
            };

            const errorMsg = this.SignalMessage.verify(message);
            if (errorMsg) {
                throw new Error(`Invalid signal message: ${errorMsg}`);
            }

            const signalInstance = this.SignalMessage.create(message);
            const wrapperMessage = {
                signal: signalInstance
            };

            const wrapperInstance = this.WebSocketMessage.create(wrapperMessage);
            const buffer = this.WebSocketMessage.encode(wrapperInstance).finish();

            this.socket.send(buffer);
        } catch (error) {
            console.error('[RTCSignaling] Failed to send SDP:', error);
            throw error;
        }
    }

    public onMessage(callback: (message: RTCSessionDescriptionInit) => void): void {
        this.onMessageCallback = callback;
    }

    public async request(description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        const messageId = crypto.randomUUID();

        try {
            await this.ensureConnected();

            const signalTypeValue = this.getSignalType(description.type);
            const signalMessage = {
                sdp: description.sdp,
                type: signalTypeValue
            };

            const requestMessage = {
                messageId: messageId,
                id: this.id,
                payload: signalMessage
            };

            const errorMsg = this.RequestMessage.verify(requestMessage);
            if (errorMsg) {
                throw new Error(`Invalid request message: ${errorMsg}`);
            }

            const requestInstance = this.RequestMessage.create(requestMessage);
            const wrapperMessage = {
                request: requestInstance
            };

            const wrapperInstance = this.WebSocketMessage.create(wrapperMessage);
            const buffer = this.WebSocketMessage.encode(wrapperInstance).finish();

            return new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
                this.pendingRequests.set(messageId, resolve);

                try {
                    this.socket.send(buffer);
                } catch (error) {
                    this.pendingRequests.delete(messageId);
                    reject(error);
                    return;
                }

                setTimeout(() => {
                    if (this.pendingRequests.has(messageId)) {
                        this.pendingRequests.delete(messageId);
                        reject(new Error('Request timed out'));
                    }
                }, 30000);
            });
        } catch (error) {
            console.error('[RTCSignaling] Failed to send request:', error);
            throw error;
        }
    }

    public close(): void {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING)) {
            this.socket.close();
        }
    }

    private getSignalType(type: string) {
        switch (type) {
            case "offer":
                return this.SignalType.values.OFFER
            case "answer":
                return this.SignalType.values.ANSWER;
            case "pranswer":
                return this.SignalType.values.PRANSWER;
            case "rollback":
                return this.SignalType.values.ROLLBACK;
            default:
                return this.SignalType.values.UNKNOWN;
        }
    }


}
