-- Инициализация базы данных WebStream
-- Создание таблиц для закрытого сайта трансляций

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица секретных кодов для регистрации
CREATE TABLE IF NOT EXISTS secret_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
    prefix VARCHAR(50),
    is_used BOOLEAN DEFAULT false,
    used_by INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Таблица активных трансляций
CREATE TABLE IF NOT EXISTS streams (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    stream_key VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    viewer_count INTEGER DEFAULT 0,
    max_viewers INTEGER DEFAULT 25
);

-- Таблица сообщений чата
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    stream_id INTEGER REFERENCES streams(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сессий пользователей
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_secret_codes_code_hash ON secret_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_secret_codes_is_used ON secret_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_streams_operator_id ON streams(operator_id);
CREATE INDEX IF NOT EXISTS idx_streams_is_active ON streams(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id ON chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Вставка начальных данных
-- Создание администратора по умолчанию
INSERT INTO users (email, password_hash, role) VALUES 
('admin@webstream.local', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Создание тестовых секретных кодов
INSERT INTO secret_codes (code, code_hash, role, prefix) VALUES 
('ADMIN123', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'ADMIN'),
('OPERATOR25', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator', 'OP'),
('VIEWER100', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'viewer', 'VW'),
('TEST123', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'viewer', 'TEST')
ON CONFLICT (code) DO NOTHING;

-- Комментарии к таблицам
COMMENT ON TABLE users IS 'Пользователи системы (зрители, операторы, администраторы)';
COMMENT ON TABLE secret_codes IS 'Секретные коды для регистрации новых пользователей';
COMMENT ON TABLE streams IS 'Активные трансляции операторов';
COMMENT ON TABLE chat_messages IS 'Сообщения в чате трансляций';
COMMENT ON TABLE user_sessions IS 'Активные сессии пользователей';

-- Миграция для добавления полей профиля пользователя
-- Добавляем поля username, description и avatar в таблицу users

-- Добавляем поле username (уникальное)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Добавляем поле description
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

-- Добавляем поле avatar (для хранения base64 изображения)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Создаем индекс для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Обновляем существующих пользователей, устанавливая username = email (если username пустой)
UPDATE users SET username = email WHERE username IS NULL OR username = '';

-- Комментарии к полям
COMMENT ON COLUMN users.username IS 'Уникальный никнейм пользователя';
COMMENT ON COLUMN users.description IS 'Описание профиля пользователя';
COMMENT ON COLUMN users.avatar IS 'Аватар пользователя в формате base64';

-- Миграция для добавления stream_key в таблицу streams
ALTER TABLE streams ADD COLUMN IF NOT EXISTS stream_key VARCHAR(255) UNIQUE;

-- Обновляем существующие трансляции, генерируя для них ключи
UPDATE streams SET stream_key = 'STREAM' || id::text || '_' || extract(epoch from created_at)::text 
WHERE stream_key IS NULL;

