<template>
  <div class="hls-player">
    <div class="video-container">
      <video 
        ref="videoRef" 
        controls 
        autoplay 
        muted 
        playsinline
        class="video-element"
        @loadstart="onLoadStart"
        @canplay="onCanPlay"
        @error="onError"
      >
        <source :src="hlsUrl" type="application/x-mpegURL">
        Ваш браузер не поддерживает HLS видео.
      </video>
      
      <!-- Overlay для статуса -->
      <div v-if="isLoading" class="video-overlay">
        <div class="overlay-content">
          <div class="loading-spinner"></div>
          <p>Ожидание трансляции...</p>
          <p class="loading-subtitle">Плеер будет автоматически подключиться, как только оператор начнет трансляцию</p>
        </div>
      </div>
      
      <div v-if="hasError" class="video-overlay error">
        <div class="overlay-content">
          <span class="error-icon">⚠️</span>
          <p>{{ errorMessage }}</p>
          <button @click="retry" class="retry-btn">Повторить</button>
        </div>
      </div>
    </div>
    
    <!-- Информация о стриме -->
    <div class="stream-info">
      <h3>{{ streamTitle }}</h3>
      <p class="stream-status" :class="{ 'live': isLive, 'offline': !isLive }">
        {{ isLive ? '🔴 LIVE' : '⚫ OFFLINE' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Hls from 'hls.js'

const props = defineProps({
  streamName: {
    type: String,
    required: true
  },
  streamTitle: {
    type: String,
    default: 'Прямая трансляция'
  }
})

const emit = defineEmits(['loadstart', 'canplay', 'error', 'retry'])

// Refs
const videoRef = ref(null)
const hlsInstance = ref(null)
const checkInterval = ref(null)

// State
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const isLive = ref(false)

// Computed
const hlsUrl = computed(() => {
  return `http://151.241.228.125:8083/hls/${props.streamName}.m3u8`
})

// Methods
const checkHLSAvailability = async () => {
  try {
    const response = await fetch(hlsUrl.value, { method: 'HEAD' })
    if (response.ok && !isLive.value) {
      console.log('✅ HLS файл доступен, перезапускаем плеер')
      initHLS()
    }
  } catch (error) {
    // HLS файл недоступен, продолжаем ждать
  }
}

const startHLSMonitoring = () => {
  // Очищаем предыдущий интервал
  if (checkInterval.value) {
    clearInterval(checkInterval.value)
  }
  
  // Запускаем проверку каждые 5 секунд
  checkInterval.value = setInterval(() => {
    if (!isLive.value) {
      checkHLSAvailability()
    }
  }, 5000)
}

const stopHLSMonitoring = () => {
  if (checkInterval.value) {
    clearInterval(checkInterval.value)
    checkInterval.value = null
  }
}

const initHLS = () => {
  if (!videoRef.value) return

  // Очищаем предыдущий HLS экземпляр
  if (hlsInstance.value) {
    hlsInstance.value.destroy()
    hlsInstance.value = null
  }

  if (Hls.isSupported()) {
    // Используем hls.js для браузеров без нативной поддержки HLS
    hlsInstance.value = new Hls({
      enableWorker: true,
      lowLatencyMode: false, // Отключаем для стабильности
      backBufferLength: 90,
      maxLoadingDelay: 30, // Увеличиваем время ожидания загрузки
      maxBufferLength: 60, // Увеличиваем буфер
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5, // Увеличиваем допустимый пропуск
      maxMaxBufferLength: 120, // Максимальный буфер
      liveSyncDurationCount: 3, // Количество сегментов для синхронизации
      liveMaxLatencyDurationCount: 10, // Максимальная задержка для live
      manifestLoadingTimeOut: 30000, // 30 секунд на загрузку манифеста
      manifestLoadingMaxRetry: 999, // Бесконечные попытки загрузки манифеста
      manifestLoadingRetryDelay: 3000, // 3 секунды между попытками
      levelLoadingTimeOut: 30000, // 30 секунд на загрузку уровня
      levelLoadingMaxRetry: 999, // Бесконечные попытки загрузки уровня
      levelLoadingRetryDelay: 3000, // 3 секунды между попытками
      fragLoadingTimeOut: 30000, // 30 секунд на загрузку фрагмента
      fragLoadingMaxRetry: 999, // Бесконечные попытки загрузки фрагмента
      fragLoadingRetryDelay: 3000 // 3 секунды между попытками
    })
    
    hlsInstance.value.loadSource(hlsUrl.value)
    hlsInstance.value.attachMedia(videoRef.value)
    
    hlsInstance.value.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('✅ HLS манифест загружен, начинаем воспроизведение')
      isLoading.value = false
      isLive.value = true
      hasError.value = false
      stopHLSMonitoring() // Останавливаем мониторинг при успешном подключении
    })
    
    hlsInstance.value.on(Hls.Events.ERROR, (event, data) => {
      console.log('🔄 HLS событие:', data.type, data.details)
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (data.details === 'manifestLoadError') {
              console.log('⏳ Ожидание появления трансляции...')
              // Не показываем ошибку, просто ждем
              isLoading.value = true
              hasError.value = false
              isLive.value = false
              // Запускаем мониторинг доступности HLS файла
              startHLSMonitoring()
            } else {
              console.log('🔄 Попытка восстановления после сетевой ошибки...')
            }
            // Полностью пересоздаем HLS экземпляр после фатальной ошибки
            setTimeout(() => {
              console.log('🔄 Пересоздание HLS плеера...')
              initHLS()
            }, 3000) // Уменьшаем до 3 секунд для более быстрого реагирования
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('🔄 Попытка восстановления после ошибки медиа...')
            // Даем больше времени перед восстановлением
            setTimeout(() => {
              if (hlsInstance.value) {
                hlsInstance.value.recoverMediaError()
              }
            }, 3000)
            break
          default:
            console.log('🔄 Перезапуск HLS плеера...')
            // Даем больше времени перед полным перезапуском
            setTimeout(() => {
              initHLS()
            }, 8000) // Увеличиваем до 8 секунд
            break
        }
      } else {
        // Для нефатальных ошибок просто логируем
        console.log('⚠️ Нефатальная HLS ошибка, продолжаем...')
      }
    })
    
    console.log('✅ HLS плеер инициализирован с hls.js:', hlsUrl.value)
  } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Нативная поддержка HLS (Safari)
    videoRef.value.src = hlsUrl.value
    console.log('✅ HLS URL установлен (нативная поддержка):', hlsUrl.value)
  } else {
    // Браузер не поддерживает HLS
    handleError({ type: 'unsupported' })
  }
}

const handleError = (error) => {
  // Показываем ошибку только для критических случаев
  if (error.type === 'unsupported') {
    hasError.value = true
    isLoading.value = false
    isLive.value = false
    errorMessage.value = 'Ваш браузер не поддерживает HLS.'
    emit('error', error)
  } else {
    // Для сетевых ошибок и ошибок медиа не показываем ошибку,
    // а продолжаем попытки подключения
    console.log('🔄 Продолжаем попытки подключения...')
    isLoading.value = true
    hasError.value = false
    isLive.value = false
  }
}

const retry = () => {
  hasError.value = false
  errorMessage.value = ''
  isLoading.value = true
  isLive.value = false
  
  // Останавливаем предыдущий мониторинг
  stopHLSMonitoring()
  
  setTimeout(() => {
    initHLS()
  }, 1000)
  
  emit('retry')
}

const onLoadStart = () => {
  isLoading.value = true
  hasError.value = false
  emit('loadstart')
}

const onCanPlay = () => {
  isLoading.value = false
  emit('canplay')
}

const onError = (event) => {
  handleError({ type: 'mediaError', details: event })
}

// Lifecycle
onMounted(() => {
  // Даем больше времени OBS на запуск и создание HLS файлов
  setTimeout(() => {
    initHLS()
  }, 5000) // Увеличиваем до 5 секунд
})

onUnmounted(() => {
  // Очищаем HLS экземпляр при размонтировании
  if (hlsInstance.value) {
    hlsInstance.value.destroy()
    hlsInstance.value = null
  }
  // Останавливаем мониторинг
  stopHLSMonitoring()
})

// Watch for stream name changes
watch(() => props.streamName, () => {
  retry()
})
</script>

<style scoped>
.hls-player {
  width: 100%;
  max-width: 100%;
}

.video-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: auto;
  min-height: 300px;
  display: block;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.video-overlay.error {
  background: rgba(0, 0, 0, 0.9);
}

.overlay-content {
  text-align: center;
  color: white;
}

.overlay-content p {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
}

.loading-subtitle {
  font-size: 0.875rem !important;
  font-weight: 400 !important;
  opacity: 0.8;
  margin-top: 0.5rem !important;
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #ff0000;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.retry-btn {
  background: #ff0000;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  margin-top: 1rem;
  transition: background 0.2s;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
}

.retry-btn:hover {
  background: #e60000;
  box-shadow: 0 4px 8px rgba(255, 0, 0, 0.4);
}

.stream-info {
  padding: 1rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  margin-top: 1rem;
}

.stream-info h3 {
  margin: 0 0 0.5rem 0;
  color: white;
  font-size: 1.25rem;
}

.stream-status {
  margin: 0;
  font-weight: 600;
  font-size: 0.875rem;
}

.stream-status.live {
  color: #ff0000;
}

.stream-status.offline {
  color: #6b7280;
}

/* Адаптивность */
@media (max-width: 768px) {
  .video-element {
    min-height: 200px;
  }
  
  .stream-info {
    padding: 0.75rem;
  }
  
  .stream-info h3 {
    font-size: 1.125rem;
  }
}
</style>
