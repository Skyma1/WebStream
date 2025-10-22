/**
 * Сервис для работы с MediaSoup
 * Управление WebRTC трансляциями
 */

const mediasoup = require('mediasoup');

class MediaSoupService {
    constructor() {
        this.worker = null;
        this.router = null;
        this.transports = new Map(); // transportId -> transport
        this.producers = new Map(); // producerId -> producer
        this.consumers = new Map(); // consumerId -> consumer
        this.rooms = new Map(); // roomId -> { router, transports, producers, consumers }
    }

    /**
     * Инициализация MediaSoup
     */
    async initialize() {
        try {
            // Создание MediaSoup worker
            this.worker = await mediasoup.createWorker({
                rtcMinPort: 10000,
                rtcMaxPort: 10100,
                logLevel: 'warn',
                logTags: [
                    'info',
                    'ice',
                    'dtls',
                    'rtp',
                    'srtp',
                    'rtcp',
                ],
            });

            this.worker.on('died', () => {
                console.error('❌ MediaSoup worker умер, перезапуск...');
                process.exit(1);
            });

            console.log('✅ MediaSoup worker создан');
        } catch (error) {
            console.error('❌ Ошибка инициализации MediaSoup:', error);
            throw error;
        }
    }

    /**
     * Создание или получение комнаты
     */
    async getOrCreateRoom(roomId) {
        if (this.rooms.has(roomId)) {
            return this.rooms.get(roomId);
        }

        try {
            // Создание медиа-роутера
            const router = await this.worker.createRouter({
                mediaCodecs: [
                    {
                        kind: 'audio',
                        mimeType: 'audio/opus',
                        clockRate: 48000,
                        channels: 2,
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters: {
                            'x-google-start-bitrate': 1000,
                        },
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/h264',
                        clockRate: 90000,
                        parameters: {
                            'packetization-mode': 1,
                            'profile-level-id': '4d0032',
                            'level-asymmetry-allowed': 1,
                            'x-google-start-bitrate': 1000,
                        },
                    },
                ],
            });

            const room = {
                id: roomId,
                router,
                transports: new Map(),
                producers: new Map(),
                consumers: new Map(),
            };

            this.rooms.set(roomId, room);
            console.log(`✅ Комната ${roomId} создана`);
            
            return room;
        } catch (error) {
            console.error(`❌ Ошибка создания комнаты ${roomId}:`, error);
            throw error;
        }
    }

    /**
     * Создание WebRTC транспорта
     */
    async createWebRtcTransport(roomId, direction) {
        const room = await this.getOrCreateRoom(roomId);
        
        try {
            const transport = await room.router.createWebRtcTransport({
                listenIps: [
                    {
                        ip: '0.0.0.0',
                        announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
                    },
                ],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            // Сохранение транспорта
            room.transports.set(transport.id, transport);
            this.transports.set(transport.id, transport);

            // Обработчики событий транспорта
            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') {
                    this.cleanupTransport(transport.id);
                }
            });

            transport.on('@close', () => {
                this.cleanupTransport(transport.id);
            });

            return {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            };
        } catch (error) {
            console.error(`❌ Ошибка создания транспорта для комнаты ${roomId}:`, error);
            throw error;
        }
    }

    /**
     * Подключение транспорта
     */
    async connectTransport(transportId, dtlsParameters) {
        const transport = this.transports.get(transportId);
        if (!transport) {
            throw new Error(`Транспорт ${transportId} не найден`);
        }

        try {
            await transport.connect({ dtlsParameters });
            console.log(`✅ Транспорт ${transportId} подключен`);
        } catch (error) {
            console.error(`❌ Ошибка подключения транспорта ${transportId}:`, error);
            throw error;
        }
    }

    /**
     * Создание продюсера (для операторов)
     */
    async createProducer(roomId, transportId, kind, rtpParameters) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Комната ${roomId} не найдена`);
        }

        const transport = room.transports.get(transportId);
        if (!transport) {
            throw new Error(`Транспорт ${transportId} не найден`);
        }

        try {
            const producer = await transport.produce({
                kind,
                rtpParameters,
            });

            // Сохранение продюсера
            room.producers.set(producer.id, producer);
            this.producers.set(producer.id, producer);

            // Обработчики событий продюсера
            producer.on('transportclose', () => {
                this.cleanupProducer(producer.id);
            });

            console.log(`✅ Продюсер ${producer.id} создан (${kind})`);
            
            return {
                id: producer.id,
                kind: producer.kind,
            };
        } catch (error) {
            console.error(`❌ Ошибка создания продюсера:`, error);
            throw error;
        }
    }

    /**
     * Создание консьюмера (для зрителей)
     */
    async createConsumer(roomId, transportId, producerId, rtpCapabilities) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Комната ${roomId} не найдена`);
        }

        const transport = room.transports.get(transportId);
        if (!transport) {
            throw new Error(`Транспорт ${transportId} не найден`);
        }

        const producer = room.producers.get(producerId);
        if (!producer) {
            throw new Error(`Продюсер ${producerId} не найден`);
        }

        try {
            // Проверка совместимости RTP capabilities
            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error('Невозможно создать консьюмер с данными RTP capabilities');
            }

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
            });

            // Сохранение консьюмера
            room.consumers.set(consumer.id, consumer);
            this.consumers.set(consumer.id, consumer);

            // Обработчики событий консьюмера
            consumer.on('transportclose', () => {
                this.cleanupConsumer(consumer.id);
            });

            consumer.on('producerclose', () => {
                this.cleanupConsumer(consumer.id);
            });

            console.log(`✅ Консьюмер ${consumer.id} создан`);
            
            return {
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            };
        } catch (error) {
            console.error(`❌ Ошибка создания консьюмера:`, error);
            throw error;
        }
    }

    /**
     * Получение RTP capabilities комнаты
     */
    async getRtpCapabilities(roomId) {
        const room = await this.getOrCreateRoom(roomId);
        return room.router.rtpCapabilities;
    }

    /**
     * Получение списка продюсеров в комнате
     */
    getRoomProducers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return [];
        }

        return Array.from(room.producers.values()).map(producer => ({
            id: producer.id,
            kind: producer.kind,
            paused: producer.paused,
        }));
    }

    /**
     * Очистка транспорта
     */
    cleanupTransport(transportId) {
        const transport = this.transports.get(transportId);
        if (transport) {
            this.transports.delete(transportId);
            
            // Удаление из всех комнат
            for (const room of this.rooms.values()) {
                room.transports.delete(transportId);
            }
            
            console.log(`🧹 Транспорт ${transportId} очищен`);
        }
    }

    /**
     * Очистка продюсера
     */
    cleanupProducer(producerId) {
        const producer = this.producers.get(producerId);
        if (producer) {
            this.producers.delete(producerId);
            
            // Удаление из всех комнат
            for (const room of this.rooms.values()) {
                room.producers.delete(producerId);
            }
            
            console.log(`🧹 Продюсер ${producerId} очищен`);
        }
    }

    /**
     * Очистка консьюмера
     */
    cleanupConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (consumer) {
            this.consumers.delete(consumerId);
            
            // Удаление из всех комнат
            for (const room of this.rooms.values()) {
                room.consumers.delete(consumerId);
            }
            
            console.log(`🧹 Консьюмер ${consumerId} очищен`);
        }
    }

    /**
     * Удаление комнаты
     */
    async deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            // Закрытие всех транспортов
            for (const transport of room.transports.values()) {
                transport.close();
            }
            
            // Закрытие роутера
            room.router.close();
            
            this.rooms.delete(roomId);
            console.log(`🧹 Комната ${roomId} удалена`);
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            rooms: this.rooms.size,
            transports: this.transports.size,
            producers: this.producers.size,
            consumers: this.consumers.size,
            roomsList: Array.from(this.rooms.keys()),
        };
    }

    /**
     * Очистка всех ресурсов
     */
    async cleanup() {
        try {
            // Закрытие всех комнат
            for (const roomId of this.rooms.keys()) {
                await this.deleteRoom(roomId);
            }

            // Закрытие worker
            if (this.worker) {
                this.worker.close();
            }

            console.log('✅ MediaSoup очищен');
        } catch (error) {
            console.error('❌ Ошибка очистки MediaSoup:', error);
        }
    }
}

module.exports = MediaSoupService;

