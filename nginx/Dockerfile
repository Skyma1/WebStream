FROM tiangolo/nginx-rtmp:latest

# Копируем конфигурационные файлы
COPY nginx.conf /etc/nginx/nginx.conf
COPY rtmp.conf /etc/nginx/rtmp.conf

# Копируем entrypoint скрипт
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 1935 80

ENTRYPOINT ["/entrypoint.sh"]

