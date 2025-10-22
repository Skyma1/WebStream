/**
 * Middleware для аутентификации и авторизации
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware для проверки JWT токена
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Токен доступа не предоставлен',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7); // Убираем "Bearer "
        
        // Проверка токена
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Проверка сессии в базе данных
        const session = await req.app.locals.databaseService.findActiveSession(token);
        if (!session) {
            return res.status(401).json({
                error: 'Сессия недействительна или истекла',
                code: 'INVALID_SESSION'
            });
        }

        // Добавление информации о пользователе в запрос
        req.user = {
            id: session.user_id,
            email: session.email,
            role: session.role
        };
        
        next();
    } catch (error) {
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

        console.error('❌ Ошибка аутентификации:', error);
        return res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware для проверки роли пользователя
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Пользователь не аутентифицирован',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Недостаточно прав доступа',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

/**
 * Middleware для проверки оператора
 */
const requireOperator = requireRole(['operator', 'admin']);

/**
 * Middleware для проверки администратора
 */
const requireAdmin = requireRole(['admin']);

/**
 * Middleware для проверки зрителя или оператора
 */
const requireViewerOrOperator = requireRole(['viewer', 'operator', 'admin']);

/**
 * Опциональная аутентификация (не блокирует запрос)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const session = await req.app.locals.databaseService.findActiveSession(token);
                
                if (session) {
                    req.user = {
                        id: session.user_id,
                        email: session.email,
                        role: session.role
                    };
                }
            } catch (error) {
                // Игнорируем ошибки для опциональной аутентификации
                console.log('Опциональная аутентификация не удалась:', error.message);
            }
        }
        
        next();
    } catch (error) {
        console.error('❌ Ошибка опциональной аутентификации:', error);
        next(); // Продолжаем выполнение даже при ошибке
    }
};

/**
 * Middleware для проверки владельца ресурса или администратора
 */
const requireOwnerOrAdmin = (getUserIdFromParams) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Пользователь не аутентифицирован',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Администратор имеет доступ ко всему
        if (req.user.role === 'admin') {
            return next();
        }

        // Проверка владельца ресурса
        const resourceUserId = getUserIdFromParams(req);
        if (req.user.id !== resourceUserId) {
            return res.status(403).json({
                error: 'Доступ запрещен',
                code: 'ACCESS_DENIED'
            });
        }

        next();
    };
};

/**
 * Middleware для проверки лимитов
 */
const checkLimits = {
    // Проверка лимита операторов (максимум 10)
    operators: async (req, res, next) => {
        try {
            const activeOperators = await req.app.locals.databaseService.query(`
                SELECT COUNT(*) as count 
                FROM streams s 
                JOIN users u ON s.operator_id = u.id 
                WHERE s.is_active = true AND u.role = 'operator'
            `);
            
            const operatorCount = parseInt(activeOperators.rows[0].count);
            
            if (operatorCount >= 10) {
                return res.status(429).json({
                    error: 'Достигнут лимит активных операторов (максимум 10)',
                    code: 'OPERATOR_LIMIT_EXCEEDED',
                    current: operatorCount,
                    limit: 10
                });
            }
            
            next();
        } catch (error) {
            console.error('❌ Ошибка проверки лимита операторов:', error);
            return res.status(500).json({
                error: 'Внутренняя ошибка сервера',
                code: 'LIMIT_CHECK_ERROR'
            });
        }
    },

    // Проверка лимита зрителей (максимум 50)
    viewers: async (req, res, next) => {
        try {
            const { streamId } = req.params;
            
            const viewerCount = await req.app.locals.databaseService.query(`
                SELECT viewer_count 
                FROM streams 
                WHERE id = $1 AND is_active = true
            `, [streamId]);
            
            if (viewerCount.rows.length === 0) {
                return res.status(404).json({
                    error: 'Трансляция не найдена',
                    code: 'STREAM_NOT_FOUND'
                });
            }
            
            const currentViewers = viewerCount.rows[0].viewer_count;
            
            if (currentViewers >= 50) {
                return res.status(429).json({
                    error: 'Достигнут лимит зрителей (максимум 50)',
                    code: 'VIEWER_LIMIT_EXCEEDED',
                    current: currentViewers,
                    limit: 50
                });
            }
            
            next();
        } catch (error) {
            console.error('❌ Ошибка проверки лимита зрителей:', error);
            return res.status(500).json({
                error: 'Внутренняя ошибка сервера',
                code: 'LIMIT_CHECK_ERROR'
            });
        }
    }
};

module.exports = {
    requireAuth,
    requireRole,
    requireOperator,
    requireAdmin,
    requireViewerOrOperator,
    optionalAuth,
    requireOwnerOrAdmin,
    checkLimits
};
