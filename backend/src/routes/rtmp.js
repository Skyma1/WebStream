/**
 * RTMP маршруты для OBS стриминга
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/streams/rtmp/start:
 *   post:
 *     summary: Начало RTMP стрима
 *     tags: [RTMP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Имя стрима
 *               addr:
 *                 type: string
 *                 description: IP адрес клиента
 *     responses:
 *       200:
 *         description: Стрим начат
 */
router.post('/start', async (req, res) => {
    try {
        const { name, addr } = req.body;
        
        console.log(`🎬 RTMP стрим начат: ${name} от ${addr}`);
        
        // Обновляем статус трансляции в БД
        const streamId = parseInt(name);
        if (streamId && !isNaN(streamId)) {
            const updateQuery = `
                UPDATE streams 
                SET is_active = true, started_at = CURRENT_TIMESTAMP 
                WHERE id = $1
            `;
            await req.app.locals.databaseService.query(updateQuery, [streamId]);
            console.log(`✅ Статус трансляции ${streamId} обновлен на активный`);
        }
        
        res.json({ 
            success: true, 
            message: 'RTMP стрим начат',
            streamName: name 
        });
        
    } catch (error) {
        console.error('❌ Ошибка начала RTMP стрима:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'RTMP_START_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/rtmp/stop:
 *   post:
 *     summary: Окончание RTMP стрима
 *     tags: [RTMP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Имя стрима
 *               addr:
 *                 type: string
 *                 description: IP адрес клиента
 *     responses:
 *       200:
 *         description: Стрим остановлен
 */
router.post('/stop', async (req, res) => {
    try {
        const { name, addr } = req.body;
        
        console.log(`⏹️ RTMP стрим остановлен: ${name} от ${addr}`);
        
        // Обновляем статус трансляции в БД
        const streamId = parseInt(name);
        if (streamId && !isNaN(streamId)) {
            const updateQuery = `
                UPDATE streams 
                SET is_active = false, ended_at = CURRENT_TIMESTAMP 
                WHERE id = $1
            `;
            await req.app.locals.databaseService.query(updateQuery, [streamId]);
            console.log(`✅ Статус трансляции ${streamId} обновлен на неактивный`);
        }
        
        res.json({ 
            success: true, 
            message: 'RTMP стрим остановлен',
            streamName: name 
        });
        
    } catch (error) {
        console.error('❌ Ошибка остановки RTMP стрима:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'RTMP_STOP_ERROR'
        });
    }
});

/**
 * @swagger
 * /api/streams/rtmp/status:
 *   get:
 *     summary: Статус RTMP стримов
 *     tags: [RTMP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Статус стримов
 */
router.get('/status', async (req, res) => {
    try {
        // Здесь можно добавить логику для получения статуса
        // активных RTMP стримов
        
        res.json({
            success: true,
            activeStreams: [],
            message: 'RTMP сервер работает'
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения статуса RTMP:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'RTMP_STATUS_ERROR'
        });
    }
});

module.exports = router;

