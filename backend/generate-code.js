#!/usr/bin/env node

/**
 * Скрипт для генерации секретных кодов регистрации
 * Использование:
 *   node generate-code.js                    # Код для viewer на 30 дней
 *   node generate-code.js operator 60        # Код для operator на 60 дней
 *   node generate-code.js admin              # Код для admin на 30 дней
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Инициализация подключения к БД
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://webstream:webstream@localhost:5432/webstream'
});

// Допустимые роли
const VALID_ROLES = ['viewer', 'operator', 'admin'];

/**
 * Генерирует случайный код
 * @returns {string} Случайный 8-символьный код в верхнем регистре
 */
function generateRandomCode() {
    return crypto.randomBytes(6).toString('hex').toUpperCase().substring(0, 8);
}

/**
 * Создаёт новый секретный код в БД
 * @param {string} role - Роль пользователя (viewer, operator, admin)
 * @param {number} expiresInDays - Количество дней до истечения кода
 */
async function createSecretCode(role = 'viewer', expiresInDays = 30) {
    try {
        // Валидация роли
        if (!VALID_ROLES.includes(role)) {
            console.error(`❌ Ошибка: Неверная роль "${role}"`);
            console.error(`✓ Допустимые роли: ${VALID_ROLES.join(', ')}`);
            process.exit(1);
        }

        // Валидация дней
        if (isNaN(expiresInDays) || expiresInDays < 1) {
            console.error('❌ Ошибка: Количество дней должно быть числом >= 1');
            process.exit(1);
        }

        // Генерируем код и его хеш
        const code = generateRandomCode();
        const codeHash = await bcrypt.hash(code, 10);

        // Вставляем в БД
        const result = await pool.query(
            `INSERT INTO secret_codes (code, code_hash, role, expires_at, created_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '${expiresInDays} days', NOW())
             RETURNING id, created_at, expires_at;`,
            [code, codeHash, role]
        );

        const row = result.rows[0];
        
        // Форматируем даты
        const createdAt = new Date(row.created_at).toLocaleString('ru-RU');
        const expiresAt = new Date(row.expires_at).toLocaleString('ru-RU');

        // Выводим результат
        console.log('\n✅ Секретный код успешно создан!\n');
        console.log(`📝 Код для регистрации: ${code}`);
        console.log(`👤 Роль: ${role}`);
        console.log(`📅 Создан: ${createdAt}`);
        console.log(`⏰ Истекает: ${expiresAt}\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Ошибка при создании кода:', error.message);
        process.exit(1);
    }
}

// Парсим аргументы командной строки
const role = process.argv[2] || 'viewer';
const expiresInDays = parseInt(process.argv[3], 10) || 30;

// Запускаем функцию
createSecretCode(role, expiresInDays);

