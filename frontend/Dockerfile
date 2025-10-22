# Dockerfile для фронтенда WebStream
FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci

# Копирование исходного кода
COPY . .

# Открытие порта
EXPOSE 8080

# Сборка приложения
RUN npm run build

# Команда запуска
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080"]
