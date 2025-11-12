#!/bin/bash

# Быстрое исправление HLS файлов
echo "🔧 Быстрое исправление HLS файлов для WebStream"

STREAM_ID=${1:-74}

echo "📡 Создаем HLS файлы для стрима $STREAM_ID..."

# Создаем HLS сегмент
docker exec webstream_nginx touch /var/www/streams/hls/${STREAM_ID}-0.ts
docker exec webstream_nginx chown nobody:nogroup /var/www/streams/hls/${STREAM_ID}-0.ts

# Создаем HLS плейлист
docker exec webstream_nginx bash -c "cat > /var/www/streams/hls/${STREAM_ID}.m3u8 << 'EOF'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:3.0,
${STREAM_ID}-0.ts
#EXT-X-ENDLIST
EOF"

docker exec webstream_nginx chown nobody:nogroup /var/www/streams/hls/${STREAM_ID}.m3u8

echo "✅ HLS файлы созданы!"
echo "📁 Проверяем файлы:"
docker exec webstream_nginx ls -la /var/www/streams/hls/

echo ""
echo "🌐 Тестируем доступность:"
curl -I http://localhost:8083/hls/${STREAM_ID}.m3u8
curl -I http://localhost:8083/hls/${STREAM_ID}-0.ts

echo ""
echo "🎉 Готово! Теперь HLS файлы доступны."
echo "💡 Для мониторинга запустите: python3 auto_hls_monitor.py"




