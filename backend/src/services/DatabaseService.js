/**
 * Сервис для работы с базой данных PostgreSQL
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

class DatabaseService {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    /**
     * Подключение к базе данных
     */
    async connect() {
        try {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Проверка подключения
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            this.isConnected = true;
            console.log('✅ Подключение к PostgreSQL установлено');
        } catch (error) {
            console.error('❌ Ошибка подключения к базе данных:', error);
            throw error;
        }
    }

    /**
     * Отключение от базы данных
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ Соединение с базой данных закрыто');
        }
    }

    /**
     * Выполнение запроса
     */
    async query(text, params = []) {
        if (!this.pool) {
            throw new Error('Пул соединений не инициализирован');
        }
        
        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('❌ Ошибка выполнения запроса:', error);
            throw error;
        }
    }

    /**
     * Получение клиента для транзакций
     */
    async getClient() {
        if (!this.isConnected) {
            throw new Error('База данных не подключена');
        }
        return await this.pool.connect();
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ ===

    /**
     * Создание нового пользователя
     */
    async createUser(userData) {
        const { username, password, role, email } = userData;
        const passwordHash = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO users (username, password_hash, role, email)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, role, created_at
        `;
        
        // Email опциональный, может быть null
        const result = await this.query(query, [username, passwordHash, role, email || null]);
        return result.rows[0];
    }

    /**
     * Поиск пользователя по email
     */
    async findUserByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
        const result = await this.query(query, [email]);
        return result.rows[0] || null;
    }

    /**
     * Поиск пользователя по username
     */
    async findUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
        const result = await this.query(query, [username]);
        return result.rows[0] || null;
    }

    /**
     * Поиск пользователя по ID
     */
    async findUserById(id) {
        const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Проверка пароля пользователя
     */
    async verifyPassword(password, passwordHash) {
        return await bcrypt.compare(password, passwordHash);
    }

    /**
     * Получение всех пользователей
     */
    async getAllUsers() {
        const query = `
            SELECT id, email, role, is_active, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `;
        const result = await this.query(query);
        return result.rows;
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С СЕКРЕТНЫМИ КОДАМИ ===

    /**
     * Создание нового секретного кода
     */
    async createSecretCode(codeData) {
        const { code, role, prefix } = codeData;
        const codeHash = await bcrypt.hash(code, 10);
        
        const query = `
            INSERT INTO secret_codes (code, code_hash, role, prefix)
            VALUES ($1, $2, $3, $4)
            RETURNING id, code, role, prefix, created_at
        `;
        
        const result = await this.query(query, [code, codeHash, role, prefix]);
        return result.rows[0];
    }

    /**
     * Поиск секретного кода (для регистрации - проверяет is_used)
     */
    async findSecretCode(code) {
        const query = `
            SELECT * FROM secret_codes 
            WHERE code = $1 
            AND is_used = false 
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `;
        const result = await this.query(query, [code]);
        return result.rows[0] || null;
    }

    /**
     * Проверка секретного кода для входа (не проверяет is_used - можно использовать многократно)
     */
    async validateSecretCodeForLogin(code) {
        const query = `
            SELECT * FROM secret_codes 
            WHERE code = $1 
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `;
        const result = await this.query(query, [code]);
        return result.rows[0] || null;
    }

    /**
     * Проверка и использование секретного кода
     */
    async useSecretCode(code, userId) {
        const client = await this.getClient();
        
        try {
            await client.query('BEGIN');
            
            // Поиск кода
            const codeQuery = 'SELECT * FROM secret_codes WHERE code = $1 AND is_used = false';
            const codeResult = await client.query(codeQuery, [code]);
            
            if (codeResult.rows.length === 0) {
                throw new Error('Код не найден или уже использован');
            }
            
            const secretCode = codeResult.rows[0];
            
            // Отметка кода как использованного
            const updateQuery = `
                UPDATE secret_codes 
                SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;
            await client.query(updateQuery, [userId, secretCode.id]);
            
            await client.query('COMMIT');
            return secretCode;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Получение всех секретных кодов
     */
    async getAllSecretCodes() {
        const query = `
            SELECT 
                sc.id, sc.code, sc.role, sc.prefix, sc.is_used, 
                sc.created_at, sc.used_at, sc.expires_at,
                u.email as used_by_email
            FROM secret_codes sc
            LEFT JOIN users u ON sc.used_by = u.id
            ORDER BY sc.created_at DESC
        `;
        const result = await this.query(query);
        return result.rows;
    }

    /**
     * Удаление секретного кода
     */
    async deleteSecretCode(id) {
        const query = 'DELETE FROM secret_codes WHERE id = $1';
        const result = await this.query(query, [id]);
        return result.rowCount > 0;
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С ТРАНСЛЯЦИЯМИ ===

    /**
     * Генерация сложного ключа трансляции
     */
    generateStreamKey() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 12).toUpperCase();
        const prefix = 'STREAM';
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * Создание новой трансляции
     */
    async createStream(streamData) {
        const { operatorId, title, description } = streamData;
        const streamKey = this.generateStreamKey();
        
        const query = `
            INSERT INTO streams (operator_id, title, description, is_active, stream_key)
            VALUES ($1, $2, $3, false, $4)
            RETURNING id, operator_id, title, description, is_active, started_at, stream_key
        `;
        
        const result = await this.query(query, [operatorId, title, description, streamKey]);
        return result.rows[0];
    }

    /**
     * Получение активных трансляций
     */
    async getActiveStreams() {
        const query = `
            SELECT 
                s.id,
                s.title,
                s.description,
                s.is_active,
                s.started_at,
                s.viewer_count,
                s.stream_key,
                u.email AS operator_email,
                u.username AS operator_username
            FROM streams s
            JOIN users u ON s.operator_id = u.id
            WHERE s.is_active = true
            ORDER BY s.started_at DESC
        `;
        const result = await this.query(query);
        return result.rows;
    }

    /**
     * Получение трансляции по ID
     */
    async getStreamById(streamId) {
        const query = `
            SELECT 
                s.id,
                s.title,
                s.description,
                s.is_active,
                s.started_at,
                s.ended_at,
                s.viewer_count,
                s.operator_id,
                s.stream_key,
                u.username AS operator_username,
                u.email AS operator_email
            FROM streams s
            LEFT JOIN users u ON s.operator_id = u.id
            WHERE s.id = $1
            LIMIT 1
        `;

        const result = await this.query(query, [streamId]);
        return result.rows[0] || null;
    }

    async getActiveStreamsByOperator(operatorId) {
        const query = `
            SELECT 
                s.id,
                s.title,
                s.description,
                s.is_active,
                s.started_at,
                s.viewer_count,
                s.stream_key
            FROM streams s
            WHERE s.operator_id = $1 AND s.is_active = true
            ORDER BY s.started_at DESC
        `;
        const result = await this.query(query, [operatorId]);
        return result.rows;
    }

    /**
     * Завершение трансляции
     */
    async endStream(streamId) {
        const query = `
            UPDATE streams 
            SET is_active = false, ended_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, ended_at
        `;
        const result = await this.query(query, [streamId]);
        return result.rows[0];
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С ЧАТОМ ===

    /**
     * Сохранение сообщения чата
     */
    async saveChatMessage(messageData) {
        const { streamId, userId, message, messageType = 'text' } = messageData;
        
        const query = `
            INSERT INTO chat_messages (stream_id, user_id, message, message_type)
            VALUES ($1, $2, $3, $4)
            RETURNING id, created_at
        `;
        
        const result = await this.query(query, [streamId, userId, message, messageType]);
        return result.rows[0];
    }

    /**
     * Получение сообщений чата
     */
    async getChatMessages(streamId, limit = 50) {
        const query = `
            SELECT 
                cm.id, cm.stream_id, cm.message, cm.message_type, cm.created_at,
                u.id as user_id, u.username as user_username, u.email as user_email, u.role as user_role
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.stream_id = $1
            ORDER BY cm.created_at DESC
            LIMIT $2
        `;
        const result = await this.query(query, [streamId, limit]);
        return result.rows.reverse(); // Возвращаем в хронологическом порядке
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С СЕССИЯМИ ===

    /**
     * Создание сессии пользователя
     */
    async createUserSession(userId, sessionToken, expiresAt) {
        const query = `
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, created_at
        `;
        
        const result = await this.query(query, [userId, sessionToken, expiresAt]);
        return result.rows[0];
    }

    /**
     * Поиск активной сессии
     */
    async findActiveSession(sessionToken) {
        const query = `
            SELECT us.*, u.email, u.role
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.session_token = $1 
            AND us.expires_at > CURRENT_TIMESTAMP
            AND u.is_active = true
        `;
        const result = await this.query(query, [sessionToken]);
        return result.rows[0] || null;
    }

    /**
     * Удаление сессии
     */
    async deleteSession(sessionToken) {
        const query = 'DELETE FROM user_sessions WHERE session_token = $1';
        const result = await this.query(query, [sessionToken]);
        return result.rowCount > 0;
    }

    /**
     * Очистка истекших сессий
     */
    async cleanupExpiredSessions() {
        const query = 'DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP';
        const result = await this.query(query);
        return result.rowCount;
    }

    /**
     * Получение количества пользователей
     */
    async getUserCount() {
        const query = 'SELECT COUNT(*) as count FROM users';
        const result = await this.query(query);
        return parseInt(result.rows[0].count);
    }
}

module.exports = DatabaseService;
