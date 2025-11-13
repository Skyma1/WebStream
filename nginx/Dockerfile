FROM tiangolo/nginx-rtmp:latest

# Копируем конфигурационные файлы
COPY nginx.conf /etc/nginx/nginx.conf
COPY rtmp.conf /etc/nginx/rtmp.conf

# Копируем скрипты
COPY entrypoint.sh /entrypoint.sh
COPY fix-permissions.sh /fix-permissions.sh
RUN chmod +x /entrypoint.sh /fix-permissions.sh

EXPOSE 1935 80

ENTRYPOINT ["/entrypoint.sh"]

