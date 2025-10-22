/**
 * Middleware для обработки ошибок
 */

/**
 * Обработчик ошибок Express
 */
const errorHandler = (error, req, res, next) => {
    console.error('❌ Ошибка:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Ошибки валидации
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Ошибка валидации данных',
            code: 'VALIDATION_ERROR',
            details: error.details || error.message
        });
    }

    // Ошибки базы данных
    if (error.code === '23505') { // Unique violation
        return res.status(409).json({
            error: 'Запись с такими данными уже существует',
            code: 'DUPLICATE_ENTRY'
        });
    }

    if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
            error: 'Нарушение связей между данными',
            code: 'FOREIGN_KEY_VIOLATION'
        });
    }

    if (error.code === '23502') { // Not null violation
        return res.status(400).json({
            error: 'Обязательные поля не заполнены',
            code: 'NOT_NULL_VIOLATION'
        });
    }

    // Ошибки JWT
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Недействительный токен',
            code: 'INVALID_TOKEN'
        });
    }

    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Токен истек',
            code: 'TOKEN_EXPIRED'
        });
    }

    // Ошибки файловой системы
    if (error.code === 'ENOENT') {
        return res.status(404).json({
            error: 'Файл или директория не найдены',
            code: 'FILE_NOT_FOUND'
        });
    }

    if (error.code === 'EACCES') {
        return res.status(403).json({
            error: 'Недостаточно прав доступа к файлу',
            code: 'FILE_ACCESS_DENIED'
        });
    }

    // Ошибки сети
    if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Сервис недоступен',
            code: 'SERVICE_UNAVAILABLE'
        });
    }

    if (error.code === 'ETIMEDOUT') {
        return res.status(504).json({
            error: 'Превышено время ожидания',
            code: 'TIMEOUT'
        });
    }

    // Ошибки MediaSoup
    if (error.message && error.message.includes('mediasoup')) {
        return res.status(500).json({
            error: 'Ошибка медиа-сервера',
            code: 'MEDIA_SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

    // Ошибки Socket.IO
    if (error.message && error.message.includes('socket')) {
        return res.status(500).json({
            error: 'Ошибка WebSocket соединения',
            code: 'WEBSOCKET_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

    // Ошибки WebRTC
    if (error.message && (error.message.includes('webrtc') || error.message.includes('ice'))) {
        return res.status(500).json({
            error: 'Ошибка WebRTC соединения',
            code: 'WEBRTC_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

    // Ошибки лимитов
    if (error.message && error.message.includes('limit')) {
        return res.status(429).json({
            error: 'Превышен лимит',
            code: 'LIMIT_EXCEEDED',
            details: error.message
        });
    }

    // Ошибки аутентификации
    if (error.message && (error.message.includes('auth') || error.message.includes('login'))) {
        return res.status(401).json({
            error: 'Ошибка аутентификации',
            code: 'AUTH_ERROR',
            details: error.message
        });
    }

    // Ошибки авторизации
    if (error.message && error.message.includes('permission')) {
        return res.status(403).json({
            error: 'Недостаточно прав доступа',
            code: 'PERMISSION_DENIED',
            details: error.message
        });
    }

    // Ошибки валидации данных
    if (error.message && error.message.includes('validation')) {
        return res.status(400).json({
            error: 'Ошибка валидации данных',
            code: 'VALIDATION_ERROR',
            details: error.message
        });
    }

    // Ошибки ресурсов
    if (error.message && (error.message.includes('not found') || error.message.includes('не найден'))) {
        return res.status(404).json({
            error: 'Ресурс не найден',
            code: 'RESOURCE_NOT_FOUND',
            details: error.message
        });
    }

    // Ошибки конфликтов
    if (error.message && error.message.includes('conflict')) {
        return res.status(409).json({
            error: 'Конфликт данных',
            code: 'CONFLICT',
            details: error.message
        });
    }

    // Ошибки сервера по умолчанию
    const statusCode = error.statusCode || error.status || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Внутренняя ошибка сервера' 
        : error.message;

    return res.status(statusCode).json({
        error: message,
        code: error.code || 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error.details
        })
    });
};

/**
 * Middleware для обработки 404 ошибок
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Маршрут не найден',
        code: 'ROUTE_NOT_FOUND',
        path: req.originalUrl,
        method: req.method
    });
};

/**
 * Middleware для обработки необработанных промисов
 */
const unhandledRejectionHandler = (reason, promise) => {
    console.error('❌ Необработанное отклонение промиса:', {
        reason: reason,
        promise: promise,
        timestamp: new Date().toISOString()
    });
};

/**
 * Middleware для обработки необработанных исключений
 */
const uncaughtExceptionHandler = (error) => {
    console.error('❌ Необработанное исключение:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Корректное завершение процесса
    process.exit(1);
};

/**
 * Middleware для логирования запросов
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        };

        if (res.statusCode >= 400) {
            console.error('❌ Ошибка запроса:', logData);
        } else {
            console.log('📝 Запрос:', logData);
        }
    });

    next();
};

/**
 * Middleware для проверки здоровья сервиса
 */
const healthCheck = (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    res.json(healthData);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    unhandledRejectionHandler,
    uncaughtExceptionHandler,
    requestLogger,
    healthCheck
};

