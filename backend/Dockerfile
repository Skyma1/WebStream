# Dockerfile для бэкенда WebStream
FROM node:18-bullseye

# Установка всех зависимостей для MediaSoup
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    gcc \
    build-essential \
    git \
    cmake \
    ninja-build \
    meson \
    pkg-config \
    libssl-dev \
    libuv1-dev \
    && rm -rf /var/lib/apt/lists/*

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей (включая dev для компиляции нативных модулей)
RUN npm ci

# Копирование исходного кода
COPY . .

# Создание пользователя для безопасности
RUN groupadd -g 1001 nodejs
RUN useradd -r -u 1001 -g nodejs nodejs

# Изменение владельца файлов
RUN chown -R nodejs:nodejs /app
USER nodejs

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD ["node", "src/app.js"]
