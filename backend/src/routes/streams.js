/**
 * Маршруты для работы с трансляциями
 * Создание, управление и просмотр трансляций
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireOperator, requireViewerOrOperator, checkLimits } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Stream:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         is_active:
 *           type: boolean
 *         started_at:
 *           type: string
 *           format: date-time
 *         ended_at:
 *           type: string
 *           format: date-time
 *         viewer_count:
 *           type: integer
 *         operator_email:
 *           type: string
 *     CreateStreamRequest:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 255
 *         description:
 *           type: string
 *           maxLength: 1000
 */

/**
 * @swagger
 * /api/streams:
 *   get:
 *     summary: Получение активных трансляций
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список активных трансляций
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Stream'
 */
router.get('/', requireViewerOrOperator, async (req, res) => {
    try {
        const streams = await req.app.locals.databaseService.getActiveStreams();
        
        // Скрываем stream_key от зрителей
        const filteredStreams = streams.map(stream => {
            if (req.user.role !== 'operator' && req.user.role !== 'admin') {
                const { stream_key, ...streamWithoutKey } = stream;
                return streamWithoutKey;
            }
            return stream;
        });
        
        res.json(filteredStreams);

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
 * /api/streams:
 *   post:
 *     summary: Создание новой трансляции (только для операторов)
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStreamRequest'
 *     responses:
 *       201:
 *         description: Трансляция успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stream'
 *       400:
 *         description: Ошибка валидации
 *       429:
 *         description: Превышен лимит операторов
 */
router.post('/', requireOperator, checkLimits.operators, [
    body('title')
        .notEmpty()
        .isLength({ max: 255 })
        .withMessage('Название трансляции обязательно и не должно превышать 255 символов'),
    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Описание не должно превышать 1000 символов')
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

        const { title, description } = req.body;

        // Проверка активных трансляций оператора
        const activeStreams = await req.app.locals.databaseService.getActiveStreamsByOperator(req.user.id);
        if (activeStreams.length > 0) {
            return res.status(409).json({
                error: 'У вас уже есть активная трансляция. Завершите текущую трансляцию перед созданием новой.',
                code: 'ACTIVE_STREAM_EXISTS',
                activeStream: activeStreams[0]
            });
        }

        // Создание трансляции
        const stream = await req.app.locals.databaseService.createStream({
            operatorId: req.user.id,
            title,
            description
        });

        console.log(`✅ Создана новая трансляция: "${title}" оператором ${req.user.email}`);

        res.status(201).json(stream);

    } catch (error) {
        console.error('❌ Ошибка создания трансляции:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CREATE_STREAM_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}:
 *   get:
 *     summary: Получение информации о трансляции
 *     tags: [Трансляции]
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
 *         description: Информация о трансляции
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stream'
 *       404:
 *         description: Трансляция не найдена
 */
router.get('/:id', requireViewerOrOperator, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                s.id,
                s.title,
                s.description,
                s.is_active,
                s.started_at,
                s.ended_at,
                s.viewer_count,
                s.stream_key,
                u.email AS operator_email
            FROM streams s
            JOIN users u ON s.operator_id = u.id
            WHERE s.id = $1
        `;
        const result = await req.app.locals.databaseService.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Трансляция не найдена',
                code: 'STREAM_NOT_FOUND'
            });
        }

        const stream = result.rows[0];
        
        // Скрываем stream_key от зрителей (только оператор и админ могут видеть ключ)
        if (req.user.role !== 'operator' && req.user.role !== 'admin') {
            delete stream.stream_key;
        }

        res.json(stream);

    } catch (error) {
        console.error('❌ Ошибка получения трансляции:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_STREAM_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/end:
 *   patch:
 *     summary: Завершение трансляции (только оператор-владелец)
 *     tags: [Трансляции]
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
 *         description: Трансляция успешно завершена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Трансляция не найдена
 */
router.patch('/:id/end', requireOperator, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка владельца трансляции
        const streamQuery = 'SELECT * FROM streams WHERE id = $1 AND operator_id = $2';
        const streamResult = await req.app.locals.databaseService.query(streamQuery, [id, req.user.id]);

        if (streamResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Трансляция не найдена или у вас нет прав на её завершение',
                code: 'STREAM_NOT_FOUND_OR_NO_PERMISSION'
            });
        }

        const stream = streamResult.rows[0];
        if (!stream.is_active) {
            return res.status(400).json({
                error: 'Трансляция уже завершена',
                code: 'STREAM_ALREADY_ENDED'
            });
        }

        // Завершение трансляции
        await req.app.locals.databaseService.endStream(id);

        console.log(`✅ Трансляция завершена: "${stream.title}" оператором ${req.user.email}`);

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
 * @swagger
 * /api/streams/{id}/chat:
 *   get:
 *     summary: Получение сообщений чата трансляции
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Список сообщений чата
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   message:
 *                     type: string
 *                   message_type:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   user_email:
 *                     type: string
 *                   user_role:
 *                     type: string
 */
router.get('/:id/chat', requireViewerOrOperator, async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        // Проверка существования трансляции
        const streamQuery = 'SELECT id FROM streams WHERE id = $1';
        const streamResult = await req.app.locals.databaseService.query(streamQuery, [id]);

        if (streamResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Трансляция не найдена',
                code: 'STREAM_NOT_FOUND'
            });
        }

        // Получение сообщений чата
        const messages = await req.app.locals.databaseService.getChatMessages(id, limit);
        
        // Преобразование формата для frontend
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            stream_id: msg.stream_id,
            message: msg.message,
            message_type: msg.message_type,
            user: {
                id: msg.user_id,
                username: msg.user_username,
                email: msg.user_email,
                role: msg.user_role
            },
            timestamp: msg.created_at
        }));
        
        res.json(formattedMessages);

    } catch (error) {
        console.error('❌ Ошибка получения сообщений чата:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_CHAT_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/rtp-capabilities:
 *   get:
 *     summary: Получение RTP capabilities для WebRTC
 *     tags: [Трансляции]
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
 *         description: RTP capabilities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rtpCapabilities:
 *                   type: object
 */
router.get('/:id/webrtc/rtp-capabilities', requireViewerOrOperator, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверка доступности MediaSoup
        if (!req.app.locals.mediaSoupService.worker) {
            return res.status(503).json({
                error: 'WebRTC функции недоступны. Используйте RTMP + HLS стриминг.',
                code: 'WEBRTC_UNAVAILABLE'
            });
        }
        
        // Получение RTP capabilities из MediaSoup
        const rtpCapabilities = await req.app.locals.mediaSoupService.getRtpCapabilities(id);
        
        res.json({ rtpCapabilities });

    } catch (error) {
        console.error('❌ Ошибка получения RTP capabilities:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_RTP_CAPABILITIES_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/transport:
 *   post:
 *     summary: Создание WebRTC транспорта
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - direction
 *             properties:
 *               direction:
 *                 type: string
 *                 enum: [send, recv]
 *     responses:
 *       201:
 *         description: WebRTC транспорт создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 iceParameters:
 *                   type: object
 *                 iceCandidates:
 *                   type: array
 *                 dtlsParameters:
 *                   type: object
 */
router.post('/:id/webrtc/transport', requireViewerOrOperator, [
    body('direction')
        .isIn(['send', 'recv'])
        .withMessage('Направление должно быть send или recv')
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

        const { id } = req.params;
        const { direction } = req.body;

        // Проверка доступности MediaSoup
        if (!req.app.locals.mediaSoupService.worker) {
            return res.status(503).json({
                error: 'WebRTC функции недоступны. Используйте RTMP + HLS стриминг.',
                code: 'WEBRTC_UNAVAILABLE'
            });
        }

        // Создание WebRTC транспорта через MediaSoup
        const transport = await req.app.locals.mediaSoupService.createWebRtcTransport(id, direction);
        
        res.status(201).json(transport);

    } catch (error) {
        console.error('❌ Ошибка создания WebRTC транспорта:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CREATE_TRANSPORT_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/transport/{transportId}/connect:
 *   post:
 *     summary: Подключение WebRTC транспорта
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: transportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dtlsParameters
 *             properties:
 *               dtlsParameters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Транспорт подключен
 */
router.post('/:id/webrtc/transport/:transportId/connect', requireViewerOrOperator, [
    body('dtlsParameters')
        .notEmpty()
        .withMessage('DTLS параметры обязательны')
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

        const { id, transportId } = req.params;
        const { dtlsParameters } = req.body;

        await req.app.locals.mediaSoupService.connectTransport(transportId, dtlsParameters);
        
        res.json({ success: true });

    } catch (error) {
        console.error('❌ Ошибка подключения WebRTC транспорта:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CONNECT_TRANSPORT_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/producer:
 *   post:
 *     summary: Создание продюсера (для операторов)
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transportId
 *               - kind
 *               - rtpParameters
 *             properties:
 *               transportId:
 *                 type: string
 *               kind:
 *                 type: string
 *                 enum: [audio, video]
 *               rtpParameters:
 *                 type: object
 *     responses:
 *       201:
 *         description: Продюсер создан
 */
router.post('/:id/webrtc/producer', requireOperator, [
    body('transportId').notEmpty().withMessage('ID транспорта обязателен'),
    body('kind').isIn(['audio', 'video']).withMessage('Тип должен быть audio или video'),
    body('rtpParameters').notEmpty().withMessage('RTP параметры обязательны')
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

        const { id } = req.params;
        const { transportId, kind, rtpParameters } = req.body;

        const producer = await req.app.locals.mediaSoupService.createProducer(
            id, transportId, kind, rtpParameters
        );
        
        res.status(201).json(producer);

    } catch (error) {
        console.error('❌ Ошибка создания продюсера:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CREATE_PRODUCER_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/consumer:
 *   post:
 *     summary: Создание консьюмера (для зрителей)
 *     tags: [Трансляции]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transportId
 *               - producerId
 *               - rtpCapabilities
 *             properties:
 *               transportId:
 *                 type: string
 *               producerId:
 *                 type: string
 *               rtpCapabilities:
 *                 type: object
 *     responses:
 *       201:
 *         description: Консьюмер создан
 */
router.post('/:id/webrtc/consumer', requireViewerOrOperator, [
    body('transportId').notEmpty().withMessage('ID транспорта обязателен'),
    body('producerId').notEmpty().withMessage('ID продюсера обязателен'),
    body('rtpCapabilities').notEmpty().withMessage('RTP capabilities обязательны')
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

        const { id } = req.params;
        const { transportId, producerId, rtpCapabilities } = req.body;

        const consumer = await req.app.locals.mediaSoupService.createConsumer(
            id, transportId, producerId, rtpCapabilities
        );
        
        res.status(201).json(consumer);

    } catch (error) {
        console.error('❌ Ошибка создания консьюмера:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'CREATE_CONSUMER_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/webrtc/producers:
 *   get:
 *     summary: Получение списка продюсеров в трансляции
 *     tags: [Трансляции]
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
 *         description: Список продюсеров
 */
router.get('/:id/webrtc/producers', requireViewerOrOperator, async (req, res) => {
    try {
        const { id } = req.params;
        
        const producers = req.app.locals.mediaSoupService.getRoomProducers(id);
        
        res.json(producers);

    } catch (error) {
        console.error('❌ Ошибка получения продюсеров:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'GET_PRODUCERS_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/{id}/viewers:
 *   get:
 *     tags: [Streams]
 *     summary: Получить список зрителей трансляции (только для операторов и админов)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список зрителей успешно получен
 *       403:
 *         description: Доступ запрещён
 */
router.get('/:id/viewers', requireOperator, async (req, res) => {
    try {
        const streamId = parseInt(req.params.id);

        // Проверяем существование трансляции
        const stream = await req.app.locals.databaseService.getStreamById(streamId);
        if (!stream) {
            return res.status(404).json({
                error: 'Трансляция не найдена',
                code: 'STREAM_NOT_FOUND'
            });
        }

        // Проверяем права доступа (оператор может видеть только свои трансляции)
        if (req.user.role === 'operator' && stream.operator_id !== req.user.userId) {
            return res.status(403).json({
                error: 'Доступ запрещён. Вы можете просматривать зрителей только своих трансляций.',
                code: 'FORBIDDEN'
            });
        }

        // Получаем список зрителей из SocketService
        const socketService = req.app.locals.socketService;
        
        if (!socketService) {
            console.error('❌ SocketService не инициализирован в app.locals');
            return res.status(503).json({
                error: 'Сервис не доступен. SocketService не инициализирован.',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const viewers = socketService.getStreamViewers(streamId);

        res.json({
            streamId: streamId,
            viewerCount: viewers.length,
            viewers: viewers.map(v => ({
                id: v.id,
                username: v.username,
                role: v.role,
                connectedAt: v.connectedAt
            }))
        });
    } catch (error) {
        console.error('❌ Ошибка получения списка зрителей:', error);
        res.status(500).json({
            error: 'Ошибка получения списка зрителей',
            code: 'GET_VIEWERS_ERROR',
            details: error.message
        });
    }
});

module.exports = router;
