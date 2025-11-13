#!/bin/bash

# Создаем директории с правильными правами
mkdir -p /var/www/streams/hls /var/www/streams/recordings
chmod -R 755 /var/www/streams

# Запускаем скрипт мониторинга прав в фоне
/fix-permissions.sh &

# Запускаем nginx
exec nginx -g "daemon off;"

