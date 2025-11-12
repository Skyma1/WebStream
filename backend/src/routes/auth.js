/**
 * Маршруты для аутентификации
 * Регистрация, вход, выход
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [viewer, operator, admin]
 *         created_at:
 *           type: string
 *           format: date-time
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         code:
 *           type: string
 */

/**
 * @swagger
 * /api/auth/check-first-user:
 *   get:
 *     summary: Проверка первого пользователя
 *     tags: [Аутентификация]
 *     responses:
 *       200:
 *         description: Статус первого пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFirstUser:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/check-first-user', async (req, res) => {
    try {
        const userCount = await req.app.locals.databaseService.getUserCount();
        
        if (userCount === 0) {
            return res.json({
                isFirstUser: true,
                message: 'Система готова к созданию первого администратора'
            });
        }
        
        return res.json({
            isFirstUser: false,
            message: 'Пользователи уже существуют'
        });
    } catch (error) {
        console.error('❌ Ошибка проверки первого пользователя:', error);
        res.status(500).json({
            error: 'Ошибка проверки первого пользователя',
            code: 'CHECK_FIRST_USER_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/create-first-admin:
 *   post:
 *     summary: Создание первого администратора
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: Администратор создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Ошибка валидации
 *       409:
 *         description: Пользователи уже существуют
 */
router.post('/create-first-admin', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Имя пользователя должно быть от 3 до 20 символов')
        .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/)
        .withMessage('Имя пользователя может содержать только буквы (латиница и кириллица), цифры и подчеркивания'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Пароль должен быть не менее 6 символов')
], async (req, res) => {
    try {
        // Проверяем, что это действительно первый пользователь
        const userCount = await req.app.locals.databaseService.getUserCount();
        
        if (userCount > 0) {
            return res.status(409).json({
                error: 'Пользователи уже существуют. Используйте обычную регистрацию.',
                code: 'USERS_EXIST'
            });
        }

        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Ошибка валидации данных',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }

        const { username, password } = req.body;

        // Проверка уникальности
        const existingUser = await req.app.locals.databaseService.findUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                error: 'Пользователь с таким именем уже существует',
                code: 'USER_EXISTS'
            });
        }

        // Создание первого администратора
        const user = await req.app.locals.databaseService.createUser({
            username,
            password,
            role: 'admin'
        });

        // Генерация JWT токена
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Ошибка создания первого администратора:', error);
        res.status(500).json({
            error: 'Ошибка создания администратора',
            code: 'CREATE_ADMIN_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - secretCode
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *               password:
 *                 type: string
 *                 minLength: 6
 *               secretCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Ошибка валидации или неверный секретный код
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Пользователь с таким именем уже существует
 */
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Имя пользователя должно быть от 3 до 20 символов')
        .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/)
        .withMessage('Имя пользователя может содержать только буквы (латиница и кириллица), цифры и подчеркивания'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Пароль должен содержать минимум 6 символов'),
    body('secretCode')
        .notEmpty()
        .withMessage('Секретный код обязателен')
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

        const { username, password, secretCode } = req.body;

        // Проверка существования пользователя по username
        const existingUser = await req.app.locals.databaseService.findUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({
                error: 'Пользователь с таким именем уже существует',
                code: 'USER_EXISTS'
            });
        }

        // Проверка и использование секретного кода
        const secretCodeData = await req.app.locals.databaseService.findSecretCode(secretCode);
        if (!secretCodeData) {
            return res.status(400).json({
                error: 'Неверный или уже использованный секретный код',
                code: 'INVALID_SECRET_CODE'
            });
        }

        if (secretCodeData.is_used) {
            return res.status(400).json({
                error: 'Секретный код уже использован',
                code: 'SECRET_CODE_USED'
            });
        }

        // Создание пользователя
        const user = await req.app.locals.databaseService.createUser({
            username,
            password,
            role: secretCodeData.role
        });

        // Отметка секретного кода как использованного
        await req.app.locals.databaseService.useSecretCode(secretCode, user.id);

        // Генерация JWT токена
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Создание сессии
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
        await req.app.locals.databaseService.createUserSession(user.id, token, expiresAt);

        console.log(`✅ Новый пользователь зарегистрирован: ${username} (${user.role})`);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'REGISTRATION_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - secretCode
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               secretCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Неверные учетные данные
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', [
    body('username')
        .notEmpty()
        .withMessage('Имя пользователя обязательно'),
    body('password')
        .notEmpty()
        .withMessage('Пароль обязателен'),
    body('secretCode')
        .notEmpty()
        .withMessage('Секретный код обязателен')
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

        const { username, password, secretCode } = req.body;

        // Проверка секретного кода (для входа - не проверяем is_used)
        const secretCodeData = await req.app.locals.databaseService.validateSecretCodeForLogin(secretCode);
        if (!secretCodeData) {
            return res.status(401).json({
                error: 'Неверный секретный код или истёк срок действия',
                code: 'INVALID_SECRET_CODE'
            });
        }

        // Поиск пользователя
        const user = await req.app.locals.databaseService.findUserByUsername(username);
        if (!user) {
            return res.status(401).json({
                error: 'Неверное имя пользователя или пароль',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Проверка пароля
        const isPasswordValid = await req.app.locals.databaseService.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Неверное имя пользователя или пароль',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Генерация JWT токена
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Создание сессии
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
        await req.app.locals.databaseService.createUserSession(user.id, token, expiresAt);

        console.log(`✅ Пользователь вошел в систему: ${username} (${user.role})`);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'LOGIN_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход из системы
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный выход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/logout', requireAuth, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.substring(7); // Убираем "Bearer "

        // Удаление сессии
        await req.app.locals.databaseService.deleteSession(token);

        console.log(`✅ Пользователь вышел из системы: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Успешный выход из системы'
        });

    } catch (error) {
        console.error('❌ Ошибка выхода:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'LOGOUT_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получение информации о текущем пользователе
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о пользователе
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Пользователь не аутентифицирован
 */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await req.app.locals.databaseService.findUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at
        });

    } catch (error) {
        console.error('❌ Ошибка получения информации о пользователе:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'USER_INFO_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление токена
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Токен успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *       401:
 *         description: Недействительный токен
 */
router.post('/refresh', requireAuth, async (req, res) => {
    try {
        // Генерация нового токена
        const newToken = jwt.sign(
            { userId: req.user.id, email: req.user.email, role: req.user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Удаление старой сессии
        const authHeader = req.headers.authorization;
        const oldToken = authHeader.substring(7);
        await req.app.locals.databaseService.deleteSession(oldToken);

        // Создание новой сессии
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await req.app.locals.databaseService.createUserSession(req.user.id, newToken, expiresAt);

        console.log(`✅ Токен обновлен для пользователя: ${req.user.email}`);

        res.json({
            success: true,
            token: newToken
        });

    } catch (error) {
        console.error('❌ Ошибка обновления токена:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'TOKEN_REFRESH_ERROR'
        });
    }
});

module.exports = router;
