/**
 * RTMP маршруты для OBS стриминга
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

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
        const streamKey = (name || '').trim();
        
        console.log(`🎬 RTMP стрим начат: ${streamKey || '[empty key]'} от ${addr}`);
        
        if (!streamKey) {
            return res.status(400).json({
                success: false,
                error: 'Пустой ключ трансляции',
                code: 'RTMP_INVALID_STREAM_KEY'
            });
        }

        // Обновляем статус трансляции в БД по stream_key
        const updateByKeyQuery = `
            UPDATE streams 
            SET is_active = true,
                started_at = CURRENT_TIMESTAMP 
            WHERE stream_key = $1
            RETURNING id
        `;
        let result = await req.app.locals.databaseService.query(updateByKeyQuery, [streamKey]);

        // Обратная совместимость: поддержка старых ключей с числовым id
        if (result.rowCount === 0) {
            const legacyStreamId = parseInt(streamKey, 10);
            if (!Number.isNaN(legacyStreamId)) {
                const legacyUpdateQuery = `
                UPDATE streams 
                    SET is_active = true,
                        started_at = CURRENT_TIMESTAMP 
                WHERE id = $1
                    RETURNING id
                `;
                result = await req.app.locals.databaseService.query(legacyUpdateQuery, [legacyStreamId]);
            }
        }

        if (result.rowCount > 0) {
            const updatedId = result.rows[0].id;
            console.log(`✅ Статус трансляции ${updatedId} обновлен на активный`);
        } else {
            console.warn(`⚠️ Не удалось найти трансляцию для ключа "${streamKey}"`);
        }
        
        res.json({ 
            success: true, 
            message: 'RTMP стрим начат',
            streamName: streamKey 
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
        const streamKey = (name || '').trim();
        
        console.log(`⏹️ RTMP стрим остановлен: ${streamKey || '[empty key]'} от ${addr}`);
        
        if (!streamKey) {
            return res.status(400).json({
                success: false,
                error: 'Пустой ключ трансляции',
                code: 'RTMP_INVALID_STREAM_KEY'
            });
        }

        const updateByKeyQuery = `
            UPDATE streams 
            SET is_active = false,
                ended_at = CURRENT_TIMESTAMP 
            WHERE stream_key = $1
            RETURNING id
        `;
        let result = await req.app.locals.databaseService.query(updateByKeyQuery, [streamKey]);

        if (result.rowCount === 0) {
            const legacyStreamId = parseInt(streamKey, 10);
            if (!Number.isNaN(legacyStreamId)) {
                const legacyUpdateQuery = `
                UPDATE streams 
                    SET is_active = false,
                        ended_at = CURRENT_TIMESTAMP 
                WHERE id = $1
                    RETURNING id
                `;
                result = await req.app.locals.databaseService.query(legacyUpdateQuery, [legacyStreamId]);
            }
        }

        if (result.rowCount > 0) {
            const updatedId = result.rows[0].id;
            console.log(`✅ Статус трансляции ${updatedId} обновлен на неактивный`);
            
            // Асинхронная очистка старых HLS файлов через 2 секунды
            // (даёт время последним зрителям получить последние сегменты)
            setImmediate(async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const hlsPath = '/var/www/streams/hls';
                    const streamDir = path.join(hlsPath, streamKey);
                    
                    try {
                        await fs.stat(streamDir);
                        // Папка существует, удаляем её
                        await fs.rm(streamDir, { recursive: true, force: true });
                        console.log(`🗑️ Удалены HLS файлы для стрима: ${streamDir}`);
                    } catch (e) {
                        // Папка не существует или уже удалена
                        console.log(`ℹ️ HLS папка не найдена или уже удалена: ${streamDir}`);
                    }
                } catch (error) {
                    console.error(`⚠️ Ошибка при удалении HLS файлов:`, error.message);
                    // Не прерываем выполнение, это некритичная ошибка
                }
            });
        } else {
            console.warn(`⚠️ Не удалось найти трансляцию для ключа "${streamKey}" при остановке`);
        }
        
        res.json({ 
            success: true, 
            message: 'RTMP стрим остановлен',
            streamName: streamKey 
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

