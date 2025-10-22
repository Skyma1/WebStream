/**
 * Маршруты для администратора
 * Управление секретными кодами и пользователями
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SecretCode:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *         role:
 *           type: string
 *           enum: [viewer, operator, admin]
 *         prefix:
 *           type: string
 *         is_used:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         used_at:
 *           type: string
 *           format: date-time
 *         used_by_email:
 *           type: string
 *     CreateSecretCodeRequest:
 *       type: object
 *       required:
 *         - role
 *       properties:
 *         role:
 *           type: string
 *           enum: [viewer, operator, admin]
 *         prefix:
 *           type: string
 *           maxLength: 10
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Получение статистики системы
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Статистика системы
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCodes:
 *                   type: integer
 *                 usedCodes:
 *                   type: integer
 *                 operators:
 *                   type: integer
 *                 viewers:
 *                   type: integer
 *                 activeStreams:
 *                   type: integer
 */
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        // Получение статистики секретных кодов
        const totalCodesResult = await req.app.locals.databaseService.query('SELECT COUNT(*) as count FROM secret_codes');
        const usedCodesResult = await req.app.locals.databaseService.query('SELECT COUNT(*) as count FROM secret_codes WHERE is_used = true');
        
        // Получение статистики пользователей
        const operatorsResult = await req.app.locals.databaseService.query('SELECT COUNT(*) as count FROM users WHERE role = \'operator\' AND is_active = true');
        const viewersResult = await req.app.locals.databaseService.query('SELECT COUNT(*) as count FROM users WHERE role = \'viewer\' AND is_active = true');
        
        // Получение статистики активных трансляций
        const activeStreamsResult = await req.app.locals.databaseService.query('SELECT COUNT(*) as count FROM streams WHERE is_active = true');

        const stats = {
            totalCodes: parseInt(totalCodesResult.rows[0].count),
            usedCodes: parseInt(usedCodesResult.rows[0].count),
            operators: parseInt(operatorsResult.rows[0].count),
            viewers: parseInt(viewersResult.rows[0].count),
            activeStreams: parseInt(activeStreamsResult.rows[0].count)
        };

        res.json(stats);

    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'STATS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/codes:
 *   get:
 *     summary: Получение всех секретных кодов
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список секретных кодов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SecretCode'
 */
router.get('/codes', requireAdmin, async (req, res) => {
    try {
        const codes = await req.app.locals.databaseService.getAllSecretCodes();
        res.json(codes);

    } catch (error) {
        console.error('❌ Ошибка получения секретных кодов:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_CODES_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/codes:
 *   post:
 *     summary: Создание нового секретного кода
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSecretCodeRequest'
 *     responses:
 *       201:
 *         description: Секретный код успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SecretCode'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/codes', requireAdmin, [
    body('role')
        .isIn(['viewer', 'operator', 'admin'])
        .withMessage('Роль должна быть viewer, operator или admin'),
    body('prefix')
        .optional()
        .isLength({ max: 10 })
        .withMessage('Префикс не должен превышать 10 символов')
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Ошибка валидации данных',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }

        const { role, prefix } = req.body;

        // Генерация уникального кода
        const code = generateSecretCode(role, prefix);

        // Создание секретного кода
        const secretCode = await req.app.locals.databaseService.createSecretCode({
            code,
            role,
            prefix
        });

        console.log(`✅ Создан новый секретный код: ${code} (${role})`);

        res.status(201).json(secretCode);

    } catch (error) {
        console.error('❌ Ошибка создания секретного кода:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CREATE_CODE_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/codes/{id}:
 *   delete:
 *     summary: Удаление секретного кода
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Секретный код успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Секретный код не найден
 */
router.delete('/codes/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await req.app.locals.databaseService.deleteSecretCode(id);
        
        if (!deleted) {
            return res.status(404).json({
                error: 'Секретный код не найден',
                code: 'CODE_NOT_FOUND'
            });
        }

        console.log(`✅ Секретный код удален: ID ${id}`);

        res.json({
            success: true,
            message: 'Секретный код успешно удален'
        });

    } catch (error) {
        console.error('❌ Ошибка удаления секретного кода:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'DELETE_CODE_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Получение всех пользователей
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await req.app.locals.databaseService.getAllUsers();
        res.json(users);

    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_USERS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/users/{id}/toggle:
 *   patch:
 *     summary: Активация/деактивация пользователя
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Статус пользователя изменен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.patch('/users/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования пользователя
        const user = await req.app.locals.databaseService.findUserById(id);
        if (!user) {
            return res.status(404).json({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        }

        // Переключение статуса
        const newStatus = !user.is_active;
        const query = 'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
        const result = await req.app.locals.databaseService.query(query, [newStatus, id]);

        console.log(`✅ Статус пользователя изменен: ${user.email} -> ${newStatus ? 'активен' : 'неактивен'}`);

        res.json({
            success: true,
            message: `Пользователь ${newStatus ? 'активирован' : 'деактивирован'}`,
            user: {
                id: result.rows[0].id,
                email: result.rows[0].email,
                role: result.rows[0].role,
                is_active: result.rows[0].is_active,
                created_at: result.rows[0].created_at,
                updated_at: result.rows[0].updated_at
            }
        });

    } catch (error) {
        console.error('❌ Ошибка изменения статуса пользователя:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'TOGGLE_USER_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/streams:
 *   get:
 *     summary: Получение всех трансляций
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список трансляций
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *                   started_at:
 *                     type: string
 *                     format: date-time
 *                   ended_at:
 *                     type: string
 *                     format: date-time
 *                   viewer_count:
 *                     type: integer
 *                   operator_email:
 *                     type: string
 */
router.get('/streams', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT 
                s.id, s.title, s.description, s.is_active, 
                s.started_at, s.ended_at, s.viewer_count,
                u.email as operator_email
            FROM streams s
            JOIN users u ON s.operator_id = u.id
            ORDER BY s.started_at DESC
        `;
        const result = await req.app.locals.databaseService.query(query);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Ошибка получения трансляций:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_STREAMS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/admin/streams/{id}/end:
 *   patch:
 *     summary: Принудительное завершение трансляции
 *     tags: [Администрирование]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Трансляция завершена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Трансляция не найдена
 */
router.patch('/streams/:id/end', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const endedStream = await req.app.locals.databaseService.endStream(id);
        
        if (!endedStream) {
            return res.status(404).json({
                error: 'Трансляция не найдена',
                code: 'STREAM_NOT_FOUND'
            });
        }

        console.log(`✅ Трансляция принудительно завершена: ID ${id}`);

        res.json({
            success: true,
            message: 'Трансляция успешно завершена'
        });

    } catch (error) {
        console.error('❌ Ошибка завершения трансляции:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'END_STREAM_ERROR'
        });
    }
});

/**
 * Генерация уникального секретного кода
 */
function generateSecretCode(role, prefix = '') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    let rolePrefix;
    
    switch (role) {
        case 'operator':
            rolePrefix = 'OP';
            break;
        case 'admin':
            rolePrefix = 'AD';
            break;
        default:
            rolePrefix = 'VW'; // viewer
    }
    
    if (prefix) {
        return `${prefix}${rolePrefix}${timestamp}${random}`;
    }
    
    return `${rolePrefix}${timestamp}${random}`;
}

module.exports = router;
