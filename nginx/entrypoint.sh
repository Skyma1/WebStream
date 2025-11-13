#!/bin/bash

# Устанавливаем umask для создания файлов с правами 0644 (rw-r--r--)
# Это позволит всем читать файлы, созданные nginx
umask 0022

# Создаем директории с правильными правами
mkdir -p /var/www/streams/hls /var/www/streams/recordings
chmod -R 755 /var/www/streams

# Запускаем nginx
exec nginx -g "daemon off;"

