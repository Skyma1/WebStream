<template>
  <div class="multiscreen-player">
    <div class="player-container">
      <!-- Всегда рендерим video элемент, но скрываем при загрузке/ошибке -->
      <div class="video-container" :class="{ 'video-hidden': isLoading || error }">
        <video
          ref="videoElement"
          :id="`multiscreen-video-${stream.id}`"
          class="multiscreen-video"
          controls
          muted
          autoplay
          playsinline
          preload="auto"
        >
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      </div>
      
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Загрузка трансляции...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ error }}</p>
        <button @click="retry" class="btn btn-primary btn-sm">
          Повторить
        </button>
      </div>
    </div>
    
    <div class="player-info">
      <div class="stream-title">{{ stream.title }}</div>
      <div class="stream-meta">
        <span class="operator">{{ stream.operator_username || stream.operator_email }}</span>
        <span class="viewers">👥 {{ stream.viewer_count || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Hls from 'hls.js'

const props = defineProps({
  stream: {
    type: Object,
    required: true
  },
  muted: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['error', 'loaded'])

// Refs
const videoElement = ref(null)
const isLoading = ref(true)
const error = ref(null)
const hls = ref(null)
let checkInterval = null

// Computed
const hlsUrl = computed(() => {
  return `http://localhost:8083/hls/${props.stream.id}.m3u8`
})

// Methods
const initializePlayer = () => {
  console.log(`[MS ${props.stream.id}] initializePlayer called, videoElement:`, !!videoElement.value)
  
  if (!videoElement.value) {
    console.error(`[MS ${props.stream.id}] ❌ videoElement not ready`)
    // Попробуем снова через небольшую задержку
    setTimeout(() => initializePlayer(), 500)
    return
  }
  
  isLoading.value = true
  error.value = null
  
  console.log(`[MS ${props.stream.id}] checking Hls.isSupported():`, Hls.isSupported())
  
  // Проверяем поддержку HLS
  if (Hls.isSupported()) {
    console.log(`[MS ${props.stream.id}] creating new Hls instance`)
    hls.value = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90
    })
    
    console.log(`[MS ${props.stream.id}] attaching media to video element`)
    hls.value.attachMedia(videoElement.value)
    
    hls.value.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.log(`[MS ${props.stream.id}] ✅ media attached, loading source:`, hlsUrl.value)
      hls.value?.loadSource(hlsUrl.value)
      console.log(`[MS ${props.stream.id}] starting load`)
      hls.value?.startLoad?.()
    })
    
    hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log(`✅ HLS манифест загружен для трансляции ${props.stream.id}`)
      // По умолчанию сохраняем mute=true для совместимости с политикой автоплей
      setMuted(true)
      isLoading.value = false
      emit('loaded')
      // Пытаемся начать воспроизведение
      try { videoElement.value?.play?.() } catch {}
    })

    hls.value.on(Hls.Events.MANIFEST_LOADED, () => {
      setMuted(true)
      isLoading.value = false
      try { videoElement.value?.play?.() } catch {}
    })

    hls.value.on(Hls.Events.LEVEL_LOADED, () => {
      setMuted(true)
      isLoading.value = false
      try { videoElement.value?.play?.() } catch {}
    })
    
    hls.value.on(Hls.Events.ERROR, (event, data) => {
      console.log(`[MS ${props.stream.id}] HLS error`, data?.type, data?.details)
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === 'manifestLoadError') {
          // Поток ещё не готов — ждём появления плейлиста
          startMonitoring()
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.value?.recoverMediaError?.() } catch {}
        } else {
          // Полный реинициал
          setTimeout(() => retry(), 2000)
        }
      }
    })
    
  } else if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Нативная поддержка HLS (Safari)
    videoElement.value.src = hlsUrl.value
    videoElement.value.addEventListener('loadedmetadata', () => {
      setMuted(true)
      isLoading.value = false
      emit('loaded')
      try { videoElement.value?.play?.() } catch {}
    })
    videoElement.value.addEventListener('canplay', () => {
      console.log(`[MS ${props.stream.id}] canplay`)
      isLoading.value = false
      try { videoElement.value?.play?.() } catch {}
    })
    
    videoElement.value.addEventListener('error', (e) => {
      console.error(`❌ Ошибка видео для трансляции ${props.stream.id}:`, e)
      error.value = 'Ошибка воспроизведения трансляции'
      isLoading.value = false
      emit('error', e)
    })
  } else {
    error.value = 'Браузер не поддерживает воспроизведение HLS'
    isLoading.value = false
  }
}

const retry = () => {
  if (hls.value) {
    hls.value.destroy()
    hls.value = null
  }
  initializePlayer()
}

const destroy = () => {
  if (hls.value) {
    hls.value.destroy()
    hls.value = null
  }
  if (videoElement.value) {
    videoElement.value.src = ''
    videoElement.value.load()
  }
  stopMonitoring()
}

// Watch for stream changes
watch(() => props.stream.id, () => {
  destroy()
  // Дадим чуть времени OBS на создание HLS
  setTimeout(() => initializePlayer(), 1500)
})

// Слежение за mute пропсом
watch(() => props.muted, (val) => {
  setMuted(val)
})

// Управление плеером из родителя
const play = () => videoElement.value?.play?.()
const pause = () => videoElement.value?.pause?.()
const setMuted = (val) => {
  if (videoElement.value) {
    videoElement.value.muted = !!val
  }
}
const setStream = (newStream) => {
  if (!newStream || newStream.id === props.stream.id) return
  // локально меняем src через повторную инициализацию - родитель должен обновить проп stream
}

defineExpose({ play, pause, setMuted })

const checkAvailability = async () => {
  console.log(`[MS ${props.stream.id}] checking HLS availability...`)
  try {
    const res = await fetch(hlsUrl.value, { method: 'HEAD' })
    console.log(`[MS ${props.stream.id}] HEAD response:`, res.status)
    if (res.ok) {
      console.log(`[MS ${props.stream.id}] ✅ HLS playlist is available, initializing player`)
      stopMonitoring()
      // Если плейлист появился, реинициализируем hls без ожидания
      if (hls.value) {
        try { hls.value.destroy() } catch {}
        hls.value = null
      }
      // Ждём следующего тика Vue, чтобы videoElement точно был готов
      await nextTick()
      initializePlayer()
      return true
    }
  } catch (err) {
    console.log(`[MS ${props.stream.id}] HEAD error:`, err.message)
  }
  return false
}

function startMonitoring() {
  console.log(`[MS ${props.stream.id}] starting monitoring...`)
  isLoading.value = true
  error.value = null
  stopMonitoring()
  
  // Первая проверка сразу
  checkAvailability().then(available => {
    if (!available) {
      // Если не доступен, продолжаем проверять каждые 3 секунды
      checkInterval = setInterval(checkAvailability, 3000)
    }
  })
}

function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

// Lifecycle
onMounted(async () => {
  console.log('[MS] mount player for stream', props.stream?.id)
  // Ждём, пока Vue полностью смонтирует DOM
  await nextTick()
  console.log(`[MS ${props.stream.id}] DOM ready, videoElement available:`, !!videoElement.value)
  // Запускаем мониторинг - он сам проверит и запустит initializePlayer когда плейлист появится
  startMonitoring()
})

onUnmounted(() => {
  destroy()
})
</script>

<style scoped>
.multiscreen-player {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
}

.player-container {
  flex: 1;
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-state,
.error-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 2rem;
  z-index: 2;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #ff0000;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.video-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.video-container.video-hidden {
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}

.multiscreen-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.player-info {
  padding: 1rem;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
}

.stream-title {
  font-weight: 600;
  color: white;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.stream-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.operator {
  font-weight: 500;
}

.viewers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn-primary {
  background: #ff0000;
  color: white;
  border: 1px solid #ff0000;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
}

.btn-primary:hover {
  background: #e60000;
  border-color: #e60000;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 0, 0, 0.4);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}
</style>
