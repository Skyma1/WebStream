/**
 * Главный файл приложения WebStream
 * Закрытый сайт для трансляций
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const streamRoutes = require('./routes/streams');
const userRoutes = require('./routes/users');
const rtmpRoutes = require('./routes/rtmp');

// Импорт сервисов
const DatabaseService = require('./services/DatabaseService');
const SocketService = require('./services/SocketService');
const MediaSoupService = require('./services/MediaSoupService');

// Импорт middleware
const authMiddleware = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Импорт Swagger
const swaggerConfig = require('./config/swagger');

class WebStreamApp {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        const publicIP = process.env.PUBLIC_IP || 'localhost';
        this.io = socketIo(this.server, {
            cors: {
                origin: [
                    process.env.FRONTEND_URL || "http://localhost:8080",
                    "http://frontend:8080",
                    `http://${publicIP}:8081`,
                    `http://${publicIP}:8080`,
                    `http://${publicIP}`
                ],
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        this.port = process.env.PORT || 3000;
        this.databaseService = new DatabaseService();
        this.mediaSoupService = new MediaSoupService();
        this.socketService = new SocketService(this.io, this.databaseService);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Настройка middleware
     */
    setupMiddleware() {
        // Безопасность (временно отключено для отладки CORS)
        // this.app.use(helmet({
        //     contentSecurityPolicy: {
        //         directives: {
        //             defaultSrc: ["'self'"],
        //             styleSrc: ["'self'", "'unsafe-inline'"],
        //             scriptSrc: ["'self'"],
        //             imgSrc: ["'self'", "data:", "https:"],
        //             connectSrc: ["'self'", "ws:", "wss:"]
        //         }
        //     }
        // }));

        // CORS
        const publicIP = process.env.PUBLIC_IP || 'localhost';
        const allowedOrigins = [
            process.env.FRONTEND_URL || "http://localhost:8080",
            "http://frontend:8080",
            `http://${publicIP}:8081`,
            `http://${publicIP}:8080`,
            `http://${publicIP}`,
            "http://localhost:8081",
            "http://localhost:8080"
        ];
        
        this.app.use(cors({
            origin: function(origin, callback) {
                // Разрешаем запросы без origin (например, мобильные приложения или curl)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
                    callback(null, true);
                } else {
                    console.warn('⚠️ CORS blocked origin:', origin);
                    callback(null, true); // Временно разрешаем все для отладки
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 минут
            max: 100, // максимум 100 запросов с одного IP
            message: {
                error: 'Слишком много запросов с этого IP, попробуйте позже',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });
        this.app.use('/api/', limiter);

        // Парсинг JSON
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Логирование запросов
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        // Добавляем сервисы в app.locals для доступа из роутов
        this.app.locals.databaseService = this.databaseService;
        this.app.locals.socketService = this.socketService;
        this.app.locals.mediaSoupService = this.mediaSoupService;
    }

    /**
     * Настройка маршрутов
     */
    setupRoutes() {
        // Swagger документация
        this.app.use('/api-docs', swaggerConfig.swaggerUi.serve, swaggerConfig.swaggerUi.setup(swaggerConfig.swaggerSpec, swaggerConfig.swaggerUiOptions));

        // API маршруты
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/admin', authMiddleware.requireAuth, authMiddleware.requireRole(['admin']), adminRoutes);

        // ВАЖНО: RTMP хуки должны идти ДО защищенных /api/streams,
        // чтобы их не перехватывало middleware аутентификации
        this.app.use('/api/streams/rtmp', rtmpRoutes); // RTMP маршруты без аутентификации

        this.app.use('/api/streams', authMiddleware.requireAuth, streamRoutes);
        this.app.use('/api/users', authMiddleware.requireAuth, userRoutes);

        // Проксирование HLS потоков от nginx
        // Поддержка двух форматов: /hls/:streamId/:filename и /hls/:streamKey/:filename
        this.app.get('/hls/:streamIdentifier/:filename', async (req, res) => {
            const { streamIdentifier, filename } = req.params;
            let streamName = streamIdentifier;
            
            // Устанавливаем CORS заголовки для всех ответов
            res.set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type',
                'Access-Control-Max-Age': '86400'
            });
            
            // Обработка OPTIONS запроса
            if (req.method === 'OPTIONS') {
                return res.status(200).end();
            }
            
            try {
                // Проверяем, является ли streamIdentifier числовым ID
                const streamId = parseInt(streamIdentifier);
                if (!isNaN(streamId)) {
                    // Получаем stream_key по ID для безопасности
                    const stream = await this.databaseService.getStreamById(streamId);
                    if (!stream || !stream.stream_key) {
                        console.warn(`⚠️ Трансляция ID ${streamId} не найдена`);
                    return res.status(404).json({ error: 'Stream not found' });
                    }
                    streamName = stream.stream_key;
                    console.log(`🔄 Преобразовано ID ${streamId} → stream_key ${streamName}`);
                }
                
                // Читаем файл напрямую из файловой системы
                const filePath = path.join('/var/www/streams/hls', streamName, filename);
                console.log(`📂 Чтение файла: ${filePath}`);
                
                // Проверяем, что путь не выходит за границы директории (безопасность)
                const realPath = fs.realpathSync(path.join('/var/www/streams/hls', streamName)).normalize();
                const requestedPath = fs.realpathSync(filePath).normalize();
                
                if (!requestedPath.startsWith(realPath)) {
                    console.warn(`⚠️ Попытка доступа за границы директории: ${requestedPath}`);
                    return res.status(403).json({ error: 'Forbidden' });
                }
                
                // Проверяем существование файла
                if (!fs.existsSync(filePath)) {
                    console.warn(`⚠️ Файл не найден: ${filePath}`);
                    return res.status(404).json({ error: 'File not found' });
                }
                
                // Определяем тип контента
                let contentType = 'application/octet-stream';
                if (filename.endsWith('.m3u8')) {
                    contentType = 'application/vnd.apple.mpegurl';
                } else if (filename.endsWith('.ts')) {
                    contentType = 'video/mp2t';
                }
                
                // Читаем и отправляем файл
                const fileSize = fs.statSync(filePath).size;
                res.set({
                    'Content-Type': contentType,
                    'Content-Length': fileSize,
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range, Content-Type'
                });
                
                const fileStream = fs.createReadStream(filePath);
                fileStream.pipe(res);
                
                fileStream.on('error', (error) => {
                    console.error(`❌ Ошибка при чтении файла ${filePath}:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Internal server error' });
                    }
                });
            } catch (error) {
                console.error('❌ Ошибка проксирования HLS:', error);
                res.set({
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range, Content-Type'
                });
                if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        // Проверка здоровья сервиса
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            });
        });

        // Главная страница API
        this.app.get('/api', (req, res) => {
            res.json({
                message: 'WebStream API - Закрытый сайт для трансляций',
                version: '1.0.0',
                documentation: '/api-docs',
                endpoints: {
                    auth: '/api/auth',
                    admin: '/api/admin',
                    streams: '/api/streams',
                    users: '/api/users'
                }
            });
        });

        // 404 обработчик
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Маршрут не найден',
                code: 'ROUTE_NOT_FOUND',
                path: req.originalUrl
            });
        });
    }

    /**
     * Настройка обработки ошибок
     */
    setupErrorHandling() {
        this.app.use(errorHandler);
    }

    /**
     * Инициализация сервисов
     */
    async initializeServices() {
        try {
            console.log('🔧 Инициализация сервисов...');
            
            // Подключение к базе данных
            await this.databaseService.connect();
            console.log('✅ База данных подключена');

        // Инициализация MediaSoup для WebRTC (опционально)
        try {
            await this.mediaSoupService.initialize();
            console.log('✅ MediaSoup инициализирован');
        } catch (error) {
            console.warn('⚠️ MediaSoup не удалось инициализировать, WebRTC функции недоступны:', error.message);
            console.log('📺 Используется RTMP + HLS стриминг (OBS)');
        }
        
        // Сохранение сервисов в app.locals для доступа в маршрутах
        this.app.locals.mediaSoupService = this.mediaSoupService;
        this.app.locals.databaseService = this.databaseService;
        this.app.locals.socketService = this.socketService;

            // Настройка Socket.IO
            this.socketService.setupEventHandlers();
            console.log('✅ Socket.IO настроен');

            console.log('🎉 Все сервисы инициализированы успешно');
        } catch (error) {
            console.error('❌ Ошибка инициализации сервисов:', error);
            throw error;
        }
    }

    /**
     * Запуск сервера
     */
    async start() {
        try {
            await this.initializeServices();
            
            this.server.listen(this.port, () => {
                console.log(`
🚀 WebStream Server запущен!
📡 Порт: ${this.port}
🌐 API: http://localhost:${this.port}/api
📚 Документация: http://localhost:${this.port}/api-docs
🔍 Проверка здоровья: http://localhost:${this.port}/health
                `);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            console.error('❌ Ошибка запуска сервера:', error);
            process.exit(1);
        }
    }

    /**
     * Корректное завершение работы
     */
    async shutdown() {
        console.log('🛑 Получен сигнал завершения работы...');
        
        try {
            // Закрытие сервера
            this.server.close(() => {
                console.log('✅ HTTP сервер закрыт');
            });

            // Закрытие соединений
            await this.databaseService.disconnect();
            console.log('✅ Соединение с базой данных закрыто');

            await this.mediaSoupService.cleanup();
            console.log('✅ MediaSoup очищен');

            console.log('👋 Сервер корректно завершил работу');
            process.exit(0);
        } catch (error) {
            console.error('❌ Ошибка при завершении работы:', error);
            process.exit(1);
        }
    }
}

// Запуск приложения
const app = new WebStreamApp();
app.start();

module.exports = app;
