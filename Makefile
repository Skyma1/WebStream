# WebStream - Закрытый сайт для трансляций
# Makefile для управления проектом

.PHONY: help build up down logs clean install dev test

# Цвета для вывода
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

help: ## Показать справку по командам
	@echo "$(GREEN)WebStream - Закрытый сайт для трансляций$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступные команды:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Установить зависимости для разработки
	@echo "$(YELLOW)Установка зависимостей...$(NC)"
	cd backend && npm install
	cd frontend && npm install

build: ## Собрать все Docker контейнеры
	@echo "$(YELLOW)Сборка Docker контейнеров...$(NC)"
	docker-compose build

build-no-cache: ## Собрать все Docker контейнеры без кэша
	@echo "$(YELLOW)Сборка Docker контейнеров без кэша...$(NC)"
	docker-compose build --no-cache

build-frontend: ## Пересобрать только фронтенд
	@echo "$(YELLOW)Пересборка фронтенда...$(NC)"
	docker-compose build frontend
	docker-compose up -d frontend
	@echo "$(GREEN)Фронтенд пересобран и запущен!$(NC)"

build-frontend-no-cache: ## Пересобрать только фронтенд без кэша
	@echo "$(YELLOW)Пересборка фронтенда без кэша...$(NC)"
	docker-compose build --no-cache frontend
	docker-compose up -d frontend
	docker exec webstream_frontend npm run build
	@echo "$(GREEN)Фронтенд пересобран без кэша и запущен!$(NC)"

rebuild-frontend: ## Полная пересборка фронтенда (удаляет prebuild)
	@echo "$(YELLOW)Полная пересборка фронтенда...$(NC)"
	@echo "$(RED)Удаление prebuild файлов...$(NC)"
	docker exec webstream_frontend rm -rf /app/dist 2>/dev/null || true
	@echo "$(YELLOW)Пересборка фронтенда...$(NC)"
	docker exec webstream_frontend npm run build
	@echo "$(YELLOW)Перезапуск фронтенда...$(NC)"
	docker-compose restart frontend
	@echo "$(GREEN)Фронтенд полностью пересобран и перезапущен!$(NC)"
	@echo "$(YELLOW)Не забудьте очистить кэш браузера (Ctrl+Shift+R)$(NC)"

clean-frontend: ## Очистить prebuild файлы фронтенда
	@echo "$(YELLOW)Очистка prebuild файлов фронтенда...$(NC)"
	docker exec webstream_frontend rm -rf /app/dist 2>/dev/null || true
	@echo "$(GREEN)Prebuild файлы удалены!$(NC)"

update-frontend: clean-frontend rebuild-frontend ## Обновить фронтенд (очистка + пересборка)
	@echo "$(GREEN)Фронтенд обновлен!$(NC)"
	@echo "$(YELLOW)Следующие шаги:$(NC)"
	@echo "1. Очистите кэш браузера: Ctrl+Shift+R"
	@echo "2. Или откройте в режиме инкогнито"
	@echo "3. Проверьте работу на http://localhost:8080"

build-backend: ## Пересобрать только бэкенд
	@echo "$(YELLOW)Пересборка бэкенда...$(NC)"
	docker-compose build backend
	docker-compose up -d backend
	@echo "$(GREEN)Бэкенд пересобран и запущен!$(NC)"

up: ## Запустить все сервисы
	@echo "$(YELLOW)Запуск сервисов...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Сервисы запущены!$(NC)"
	@echo "Фронтенд: http://localhost:8080"
	@echo "Бэкенд API: http://localhost:3000"
	@echo "Swagger: http://localhost:3000/api-docs"

down: ## Остановить все сервисы
	@echo "$(YELLOW)Остановка сервисов...$(NC)"
	docker-compose down

restart: down build-no-cache up ## Перезапустить все сервисы с пересборкой без кэша
restart-fast: down up ## Быстрый перезапуск без пересборки

logs: ## Показать логи всех сервисов
	docker-compose logs -f

logs-backend: ## Показать логи бэкенда
	docker-compose logs -f backend

logs-frontend: ## Показать логи фронтенда
	docker-compose logs -f frontend

logs-db: ## Показать логи базы данных
	docker-compose logs -f postgres

dev: ## Запустить в режиме разработки
	@echo "$(YELLOW)Запуск в режиме разработки...$(NC)"
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

clean: ## Очистить все контейнеры и volumes
	@echo "$(RED)Очистка контейнеров и volumes...$(NC)"
	docker-compose down -v --remove-orphans
	docker system prune -f

test: ## Запустить тесты
	@echo "$(YELLOW)Запуск тестов...$(NC)"
	cd backend && npm test
	cd frontend && npm test

db-reset: ## Сбросить базу данных
	@echo "$(RED)Сброс базы данных...$(NC)"
	docker-compose down postgres
	docker volume rm webstream_postgres_data
	docker-compose up -d postgres

ssl-setup: ## Настроить SSL сертификаты (самоподписанные для разработки)
	@echo "$(YELLOW)Настройка SSL сертификатов...$(NC)"
	mkdir -p nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/ssl/nginx-selfsigned.key \
		-out nginx/ssl/nginx-selfsigned.crt \
		-subj "/C=RU/ST=Moscow/L=Moscow/O=WebStream/CN=localhost"

status: ## Показать статус сервисов
	@echo "$(YELLOW)Статус сервисов:$(NC)"
	docker-compose ps

# Команды для разработки
dev-backend: ## Запустить только бэкенд в режиме разработки
	cd backend && npm run dev

dev-frontend: ## Запустить только фронтенд в режиме разработки
	cd frontend && npm run dev

# Команды для администрирования
admin-create-code: ## Создать новый секретный код (требует запущенного бэкенда)
	@echo "$(YELLOW)Создание нового секретного кода...$(NC)"
	@read -p "Введите роль (viewer/operator): " role; \
	read -p "Введите префикс (опционально): " prefix; \
	curl -X POST http://localhost:3000/api/admin/codes \
		-H "Content-Type: application/json" \
		-d "{\"role\": \"$$role\", \"prefix\": \"$$prefix\"}"

# Команды для мониторинга
monitor: ## Показать мониторинг ресурсов
	@echo "$(YELLOW)Мониторинг ресурсов:$(NC)"
	docker stats --no-stream

# Команды для бэкапа
backup-db: ## Создать бэкап базы данных
	@echo "$(YELLOW)Создание бэкапа базы данных...$(NC)"
	mkdir -p backups
	docker-compose exec postgres pg_dump -U webstream webstream > backups/webstream_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Бэкап создан в папке backups/$(NC)"

restore-db: ## Восстановить базу данных из бэкапа
	@echo "$(YELLOW)Восстановление базы данных...$(NC)"
	@ls backups/ | head -10
	@read -p "Введите имя файла бэкапа: " backup_file; \
	docker-compose exec -T postgres psql -U webstream webstream < backups/$$backup_file

