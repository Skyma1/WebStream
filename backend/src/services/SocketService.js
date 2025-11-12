/**
 * Сервис для работы с Socket.IO
 * Обработка WebSocket соединений для чата и трансляций
 */

const jwt = require('jsonwebtoken');
const DatabaseService = require('./DatabaseService');

class SocketService {
    constructor(io, databaseService = null) {
        this.io = io;
        this.db = databaseService || new DatabaseService();
        this.connectedUsers = new Map(); // userId -> socketId
        this.streamRooms = new Map(); // streamId -> Set of socketIds
        this.userSessions = new Map(); // socketId -> userData
    }

    /**
     * Настройка обработчиков событий Socket.IO
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 Новое подключение: ${socket.id}`);
            
            // Глобальный обработчик ошибок сокета
            socket.on('error', (error) => {
                console.error('❌ Ошибка сокета:', {
                    socketId: socket.id,
                    error: error.message || error,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                // Не отправляем повторную ошибку, просто логируем
            });

            // Аутентификация пользователя
            socket.on('authenticate', async (data) => {
                try {
                    const user = await this.authenticateUser(data.token);
                    if (user) {
                        this.userSessions.set(socket.id, user);
                        this.connectedUsers.set(user.id, socket.id);
                        
                        socket.emit('authenticated', {
                            success: true,
                            user: {
                                id: user.id,
                                email: user.email,
                                role: user.role
                            }
                        });
                        
                        console.log(`✅ Пользователь аутентифицирован: ${user.email} (${user.role})`);
                    } else {
                        socket.emit('authenticated', { success: false, error: 'Неверный токен' });
                    }
                } catch (error) {
                    console.error('❌ Ошибка аутентификации:', error);
                    socket.emit('authenticated', { success: false, error: 'Ошибка аутентификации' });
                }
            });

            // Heartbeat ping/pong
            socket.on('ping', () => {
                socket.emit('pong');
            });

            // Присоединение к трансляции
            socket.on('join_stream', async (data) => {
                try {
                    const user = this.userSessions.get(socket.id);
                    if (!user) {
                        socket.emit('error', { message: 'Пользователь не аутентифицирован' });
                        socket.disconnect();
                        return;
                    }

                    const { streamId } = data;
                    const roomName = `stream_${streamId}`;
                    
                    // Присоединение к комнате трансляции
                    socket.join(roomName);
                    
                    // Логирование для отладки
                    const room = this.io.sockets.adapter.rooms.get(roomName);
                    const roomSize = room ? room.size : 0;
                    console.log(`🏠 Пользователь ${user.email} присоединился к комнате ${roomName} (всего участников: ${roomSize})`);
                    
                    // Добавление в список участников трансляции
                    if (!this.streamRooms.has(streamId)) {
                        this.streamRooms.set(streamId, new Set());
                    }
                    this.streamRooms.get(streamId).add(socket.id);

                    // Обновление счётчика зрителей в БД
                    const viewerCount = this.streamRooms.get(streamId).size;
                    await this.db.query(
                        'UPDATE streams SET viewer_count = $1 WHERE id = $2',
                        [viewerCount, streamId]
                    );

                    // Отправляем обновление счётчика всем участникам комнаты
                    this.io.to(roomName).emit('viewer_count_update', { streamId, viewerCount });

                    // Отправка истории сообщений чата
                    const chatHistory = await this.db.getChatMessages(streamId, 50);
                    // Преобразуем в правильный формат
                    const formattedHistory = chatHistory.map(msg => ({
                        id: msg.id,
                        stream_id: msg.stream_id,
                        message: msg.message,
                        user: {
                            email: msg.user_email,
                            role: msg.user_role
                        },
                        timestamp: msg.created_at
                    }));
                    socket.emit('chat_history', formattedHistory);

                    // Уведомление других участников о новом пользователе
                    socket.to(roomName).emit('user_joined', {
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role
                        },
                        timestamp: new Date().toISOString()
                    });

                    console.log(`👤 Пользователь ${user.email} присоединился к трансляции ${streamId}`);
                } catch (error) {
                    console.error('❌ Ошибка присоединения к трансляции:', error);
                    socket.emit('error', { message: 'Ошибка присоединения к трансляции' });
                    socket.disconnect();
                }
            });

            // Покидание трансляции
            socket.on('leave_stream', (data) => {
                const user = this.userSessions.get(socket.id);
                if (!user) return;

                const { streamId } = data;
                const roomName = `stream_${streamId}`;
                
                socket.leave(roomName);
                
                // Удаление из списка участников
                if (this.streamRooms.has(streamId)) {
                    this.streamRooms.get(streamId).delete(socket.id);
                    
                    // Обновление счётчика зрителей в БД
                    const viewerCount = this.streamRooms.get(streamId).size;
                    this.db.query(
                        'UPDATE streams SET viewer_count = $1 WHERE id = $2',
                        [viewerCount, streamId]
                    ).catch(err => console.error('❌ Ошибка обновления viewer_count:', err));

                    // Отправляем обновление счётчика всем участникам комнаты
                    this.io.to(roomName).emit('viewer_count_update', { streamId, viewerCount });
                }

                // Уведомление других участников
                socket.to(roomName).emit('user_left', {
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    },
                    timestamp: new Date().toISOString()
                });

                console.log(`👋 Пользователь ${user.email} покинул трансляцию ${streamId}`);
            });

            // Отправка сообщения в чат
            socket.on('chat_message', async (data) => {
                try {
                    const user = this.userSessions.get(socket.id);
                    if (!user) {
                        socket.emit('error', { message: 'Пользователь не аутентифицирован' });
                        socket.disconnect();
                        return;
                    }

                    const { streamId, message } = data;
                    
                    if (!message || message.trim().length === 0) {
                        socket.emit('error', { message: 'Сообщение не может быть пустым' });
                        return;
                    }

                    // Сохранение сообщения в базе данных
                    const savedMessage = await this.db.saveChatMessage({
                        streamId,
                        userId: user.id,
                        message: message.trim(),
                        messageType: 'text'
                    });

                    // Формирование сообщения для отправки
                    const chatMessage = {
                        id: savedMessage.id,
                        stream_id: streamId,
                        message: message.trim(),
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role
                        },
                        timestamp: savedMessage.created_at
                    };

                    // Отправка сообщения всем участникам трансляции
                    const roomName = `stream_${streamId}`;
                    
                    // Логирование для отладки
                    const room = this.io.sockets.adapter.rooms.get(roomName);
                    const roomSize = room ? room.size : 0;
                    console.log(`📡 Отправка сообщения в комнату ${roomName} (участников: ${roomSize})`);
                    
                    this.io.in(roomName).emit('new_chat_message', chatMessage);

                    console.log(`💬 Сообщение от ${user.email} в трансляции ${streamId}: ${message}`);
                } catch (error) {
                    console.error('❌ Ошибка отправки сообщения:', error);
                    socket.emit('error', { message: 'Ошибка отправки сообщения' });
                    socket.disconnect();
                }
            });

            // Системные сообщения
            socket.on('system_message', async (data) => {
                try {
                    const user = this.userSessions.get(socket.id);
                    if (!user || user.role !== 'admin') {
                        socket.emit('error', { message: 'Недостаточно прав' });
                        socket.disconnect();
                        return;
                    }

                    const { streamId, message } = data;
                    
                    // Сохранение системного сообщения
                    const savedMessage = await this.db.saveChatMessage({
                        streamId,
                        userId: user.id,
                        message: message.trim(),
                        messageType: 'system'
                    });

                    const systemMessage = {
                        id: savedMessage.id,
                        message: message.trim(),
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role
                        },
                        messageType: 'system',
                        timestamp: savedMessage.created_at
                    };

                    const roomName = `stream_${streamId}`;
                    this.io.to(roomName).emit('new_chat_message', systemMessage);

                    console.log(`🔧 Системное сообщение от ${user.email}: ${message}`);
                } catch (error) {
                    console.error('❌ Ошибка отправки системного сообщения:', error);
                    socket.emit('error', { message: 'Ошибка отправки системного сообщения' });
                    socket.disconnect();
                }
            });

            // WebRTC события для MediaSoup
            socket.on('new_producer', (data) => {
                const user = this.userSessions.get(socket.id);
                if (!user) return;

                const { streamId, producerId, kind } = data;
                const roomName = `stream_${streamId}`;
                
                // Уведомление всех зрителей о новом продюсере
                socket.to(roomName).emit('new_producer', {
                    producerId,
                    kind,
                    from: user.id
                });

                console.log(`📡 Новый продюсер ${producerId} (${kind}) в трансляции ${streamId}`);
            });

            socket.on('producer_closed', (data) => {
                const user = this.userSessions.get(socket.id);
                if (!user) return;

                const { streamId, producerId } = data;
                const roomName = `stream_${streamId}`;
                
                // Уведомление всех зрителей о закрытии продюсера
                socket.to(roomName).emit('producer_closed', {
                    producerId,
                    from: user.id
                });

                console.log(`📡 Продюсер ${producerId} закрыт в трансляции ${streamId}`);
            });

            socket.on('consumer_closed', (data) => {
                const user = this.userSessions.get(socket.id);
                if (!user) return;

                const { streamId, consumerId } = data;
                const roomName = `stream_${streamId}`;
                
                // Уведомление оператора о закрытии консьюмера
                socket.to(roomName).emit('consumer_closed', {
                    consumerId,
                    from: user.id
                });

                console.log(`📡 Консьюмер ${consumerId} закрыт в трансляции ${streamId}`);
            });

            // Отключение пользователя
            socket.on('disconnect', () => {
                const user = this.userSessions.get(socket.id);
                if (user) {
                    this.connectedUsers.delete(user.id);
                    this.userSessions.delete(socket.id);
                    
                    // Удаление из всех комнат трансляций
                    for (const [streamId, socketIds] of this.streamRooms.entries()) {
                        if (socketIds.has(socket.id)) {
                            socketIds.delete(socket.id);
                            const roomName = `stream_${streamId}`;
                            
                            // Обновление счётчика зрителей в БД
                            const viewerCount = socketIds.size;
                            this.db.query(
                                'UPDATE streams SET viewer_count = $1 WHERE id = $2',
                                [viewerCount, streamId]
                            ).catch(err => console.error('❌ Ошибка обновления viewer_count:', err));

                            // Отправляем обновление счётчика всем участникам комнаты
                            this.io.to(roomName).emit('viewer_count_update', { streamId, viewerCount });
                            
                            socket.to(roomName).emit('user_left', {
                                user: {
                                    id: user.id,
                                    email: user.email,
                                    role: user.role
                                },
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    
                    console.log(`🔌 Пользователь отключился: ${user.email}`);
                }
            });
        });
    }

    /**
     * Аутентификация пользователя по JWT токену
     */
    async authenticateUser(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await this.db.findUserById(decoded.userId);
            return user;
        } catch (error) {
            console.error('❌ Ошибка верификации токена:', error);
            return null;
        }
    }

    /**
     * Отправка уведомления всем пользователям
     */
    broadcastNotification(message, type = 'info') {
        this.io.emit('notification', {
            message,
            type,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Отправка уведомления пользователям определенной роли
     */
    broadcastToRole(role, message, type = 'info') {
        for (const [socketId, user] of this.userSessions.entries()) {
            if (user.role === role) {
                this.io.to(socketId).emit('notification', {
                    message,
                    type,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Получение статистики подключений
     */
    getConnectionStats() {
        return {
            totalConnections: this.io.engine.clientsCount,
            authenticatedUsers: this.userSessions.size,
            activeStreams: this.streamRooms.size,
            usersByRole: this.getUsersByRole()
        };
    }

    /**
     * Получение пользователей по ролям
     */
    getUsersByRole() {
        const roles = {};
        for (const user of this.userSessions.values()) {
            roles[user.role] = (roles[user.role] || 0) + 1;
        }
        return roles;
    }
}

module.exports = SocketService;
