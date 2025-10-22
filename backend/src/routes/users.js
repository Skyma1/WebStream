/**
 * Маршруты для работы с пользователями
 * Профиль пользователя и управление аккаунтом
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const DatabaseService = require('../services/DatabaseService');
const { requireAuth, requireOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();
const db = new DatabaseService();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *         role:
 *           type: string
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 6
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Получение профиля текущего пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Профиль пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Пользователь не аутентифицирован
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await db.findUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            description: user.description,
            avatar: user.avatar,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        });

    } catch (error) {
        console.error('❌ Ошибка получения профиля:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_PROFILE_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Обновление профиля пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Профиль успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Ошибка валидации
 *       409:
 *         description: Email уже используется
 */
router.put('/profile', requireAuth, [
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Введите корректный email адрес'),
    body('username')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Никнейм должен быть от 1 до 50 символов'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Описание не должно превышать 500 символов'),
    body('avatar')
        .optional()
        .isString()
        .withMessage('Аватар должен быть строкой')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Ошибка валидации данных',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }

        const { email, username, description, avatar } = req.body;
        const updates = {};
        const values = [];
        let paramCount = 1;

        // Проверка email на уникальность
        if (email) {
            const existingUser = await db.findUserByEmail(email);
            if (existingUser && existingUser.id !== req.user.id) {
                return res.status(409).json({
                    error: 'Email уже используется другим пользователем',
                    code: 'EMAIL_ALREADY_EXISTS'
                });
            }
            updates.email = email;
            values.push(email);
            paramCount++;
        }

        // Проверка username на уникальность
        if (username) {
            const existingUser = await db.findUserByUsername(username);
            if (existingUser && existingUser.id !== req.user.id) {
                return res.status(409).json({
                    error: 'Никнейм уже используется другим пользователем',
                    code: 'USERNAME_ALREADY_EXISTS'
                });
            }
            updates.username = username;
            values.push(username);
            paramCount++;
        }

        // Добавление description
        if (description !== undefined) {
            updates.description = description;
            values.push(description);
            paramCount++;
        }

        // Добавление avatar
        if (avatar !== undefined) {
            updates.avatar = avatar;
            values.push(avatar);
            paramCount++;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'Нет данных для обновления',
                code: 'NO_UPDATES'
            });
        }

        // Обновление профиля
        const setClause = Object.keys(updates).map(key => `${key} = $${paramCount++}`).join(', ');
        const query = `
            UPDATE users 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1 
            RETURNING id, email, username, description, avatar, role, is_active, created_at, updated_at
        `;
        
        const result = await db.query(query, [req.user.id, ...values]);

        console.log(`✅ Профиль обновлен для пользователя: ${req.user.email}`);

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Ошибка обновления профиля:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'UPDATE_PROFILE_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Получение статистики пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Статистика пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 streamsCount:
 *                   type: integer
 *                 followersCount:
 *                   type: integer
 *                 messagesCount:
 *                   type: integer
 *       401:
 *         description: Пользователь не аутентифицирован
 */
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Получаем количество трансляций
        const streamsResult = await db.query(
            'SELECT COUNT(*) as count FROM streams WHERE operator_id = $1',
            [userId]
        );
        const streamsCount = parseInt(streamsResult.rows[0].count);

        // Получаем количество подписчиков (пока заглушка)
        const followersCount = 0;

        // Получаем количество сообщений в чате
        const messagesResult = await db.query(
            'SELECT COUNT(*) as count FROM chat_messages WHERE user_id = $1',
            [userId]
        );
        const messagesCount = parseInt(messagesResult.rows[0].count);

        res.json({
            streamsCount,
            followersCount,
            messagesCount
        });

    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_STATS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     summary: Изменение пароля пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Пароль успешно изменен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Ошибка валидации или неверный текущий пароль
 */
router.post('/change-password', requireAuth, [
    body('currentPassword')
        .notEmpty()
        .withMessage('Текущий пароль обязателен'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Новый пароль должен содержать минимум 6 символов')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Ошибка валидации данных',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Получение текущего пользователя
        const user = await db.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        }

        // Проверка текущего пароля
        const isCurrentPasswordValid = await db.verifyPassword(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                error: 'Неверный текущий пароль',
                code: 'INVALID_CURRENT_PASSWORD'
            });
        }

        // Хеширование нового пароля
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Обновление пароля
        const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        await db.query(query, [newPasswordHash, req.user.id]);

        console.log(`✅ Пароль изменен для пользователя: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Пароль успешно изменен'
        });

    } catch (error) {
        console.error('❌ Ошибка изменения пароля:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CHANGE_PASSWORD_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получение информации о пользователе по ID
 *     tags: [Пользователи]
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
 *         description: Информация о пользователе
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Пользователь не найден
 */
router.get('/:id', requireAuth, requireOwnerOrAdmin((req) => parseInt(req.params.id)), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await db.findUserById(id);
        
        if (!user) {
            return res.status(404).json({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        });

    } catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_USER_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/sessions:
 *   get:
 *     summary: Получение активных сессий пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список активных сессий
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   last_activity:
 *                     type: string
 *                     format: date-time
 *                   expires_at:
 *                     type: string
 *                     format: date-time
 */
router.get('/sessions', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT id, created_at, last_activity, expires_at
            FROM user_sessions
            WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
            ORDER BY last_activity DESC
        `;
        const result = await db.query(query, [req.user.id]);
        
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Ошибка получения сессий:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_SESSIONS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/sessions/{sessionId}:
 *   delete:
 *     summary: Завершение конкретной сессии
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Сессия успешно завершена
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
 *         description: Сессия не найдена
 */
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const query = 'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2';
        const result = await db.query(query, [sessionId, req.user.id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Сессия не найдена',
                code: 'SESSION_NOT_FOUND'
            });
        }

        console.log(`✅ Сессия завершена для пользователя: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Сессия успешно завершена'
        });

    } catch (error) {
        console.error('❌ Ошибка завершения сессии:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'DELETE_SESSION_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/users/sessions/all:
 *   delete:
 *     summary: Завершение всех сессий пользователя
 *     tags: [Пользователи]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Все сессии успешно завершены
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 */
router.delete('/sessions/all', requireAuth, async (req, res) => {
    try {
        const query = 'DELETE FROM user_sessions WHERE user_id = $1';
        const result = await db.query(query, [req.user.id]);

        console.log(`✅ Все сессии завершены для пользователя: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Все сессии успешно завершены',
            deletedCount: result.rowCount
        });

    } catch (error) {
        console.error('❌ Ошибка завершения всех сессий:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'DELETE_ALL_SESSIONS_ERROR'
        });
    }
});

module.exports = router;

