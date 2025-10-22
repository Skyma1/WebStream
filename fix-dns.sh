#!/bin/bash

echo "🔧 Исправление DNS проблемы..."

# Проверяем текущий DNS
echo "📊 Текущий DNS сервер:"
resolvectl status | grep "Current DNS Server" || echo "DNS не настроен"

# Временно останавливаем DNS контейнер
echo "🛑 Остановка DNS контейнера..."
docker stop base-dns-1 2>/dev/null || echo "DNS контейнер уже остановлен"

# Сбрасываем DNS на системный
echo "🔄 Сброс DNS на системный..."
sudo systemctl restart systemd-resolved

# Ждем применения изменений
sleep 3

# Проверяем новый DNS
echo "📊 Новый DNS сервер:"
resolvectl status | grep "Current DNS Server" || echo "DNS не настроен"

# Тестируем интернет
echo "🌐 Тестирование интернета..."
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    echo "✅ Интернет работает (8.8.8.8 доступен)"
else
    echo "❌ Интернет не работает"
fi

if ping -c 1 google.com > /dev/null 2>&1; then
    echo "✅ DNS работает (google.com разрешается)"
else
    echo "❌ DNS не работает"
fi

echo ""
echo "💡 Теперь можно запускать WebStream проект:"
echo "   ./start-safe.sh"
echo ""
echo "⚠️  ВАЖНО: Не запускайте base-dns-1 контейнер, пока не закончите работу с WebStream!"

