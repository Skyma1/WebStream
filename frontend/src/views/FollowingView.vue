<template>
  <div class="following-page">
    <main class="following-main">
      <div class="container">
        <div class="page-header">
          <h1>Отслеживаемое</h1>
          <p>Ваши избранные трансляции и операторы</p>
        </div>

        <!-- Загрузка -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Загрузка...</p>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="followedStreams.length === 0" class="empty-state">
          <div class="empty-icon">❤️</div>
          <h3>Пока нет отслеживаемых трансляций</h3>
          <p>Начните следить за интересными операторами и их трансляциями</p>
          <router-link to="/dashboard" class="btn btn-primary">
            <span class="btn-icon">📺</span>
            Посмотреть трансляции
          </router-link>
        </div>

        <!-- Список отслеживаемых трансляций -->
        <div v-else class="followed-streams">
          <h2>Активные трансляции</h2>
          <div class="streams-grid">
            <div 
              v-for="stream in followedStreams" 
              :key="stream.id"
              class="stream-card"
            >
              <div class="stream-preview">
                <HLSPlayer 
                  :streamName="stream.id"
                  :streamTitle="stream.title"
                  :showControls="false"
                  class="preview-player"
                />
                <div class="stream-overlay">
                  <span class="live-indicator">
                    <span class="live-dot"></span>
                    LIVE
                  </span>
                  <span class="viewer-count">
                    <span class="icon">👥</span>
                    {{ stream.viewer_count || 0 }}
                  </span>
                </div>
              </div>
              
              <div class="stream-info">
                <h3 class="stream-title">{{ stream.title }}</h3>
                <p class="stream-description">{{ stream.description || 'Без описания' }}</p>
                <div class="stream-meta">
                  <span class="operator">{{ stream.operator_email }}</span>
                  <span class="duration">{{ formatDuration(stream.started_at) }}</span>
                </div>
              </div>
              
              <div class="stream-actions">
                <router-link 
                  :to="`/stream/${stream.id}`" 
                  class="btn btn-primary"
                >
                  <span class="btn-icon">▶️</span>
                  Смотреть
                </router-link>
                <button 
                  @click="unfollowStream(stream.id)"
                  class="btn btn-secondary"
                  title="Перестать отслеживать"
                >
                  <span class="btn-icon">💔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useStreamStore } from '@/store/stream'
import { useAuthStore } from '@/store/auth'
import HLSPlayer from '@/components/HLSPlayer.vue'

const streamStore = useStreamStore()
const authStore = useAuthStore()

const isLoading = ref(false)

// Получаем отслеживаемые трансляции (пока используем все активные)
const followedStreams = computed(() => {
  return streamStore.activeStreams.filter(stream => {
    // Здесь можно добавить логику фильтрации по отслеживаемым операторам
    return true
  })
})

// Методы
const formatDuration = (startTime) => {
  if (!startTime) return '0 мин'
  
  const start = new Date(startTime)
  const now = new Date()
  const diffMs = now - start
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 60) {
    return `${diffMins} мин`
  } else {
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}ч ${mins}м`
  }
}

const unfollowStream = (streamId) => {
  // Здесь можно добавить логику отписки от трансляции
  console.log('Отписка от трансляции:', streamId)
}

// Инициализация
onMounted(async () => {
  try {
    isLoading.value = true
    await streamStore.fetchStreams()
  } catch (error) {
    console.error('Ошибка загрузки трансляций:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.following-page {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.page-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.followed-streams h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: white;
}

.streams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.stream-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  position: relative;
}

.stream-card:hover {
  border-color: #3a3a3a;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}

.stream-preview {
  position: relative;
  aspect-ratio: 16/9;
  background: #000;
}

.preview-player {
  width: 100%;
  height: 100%;
}

.stream-overlay {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 0, 0, 0.9);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.viewer-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.stream-info {
  padding: 1rem;
}

.stream-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
  line-height: 1.3;
}

.stream-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
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
  color: rgba(255, 255, 255, 0.6);
}

.operator {
  font-weight: 500;
}

.stream-actions {
  padding: 0 1rem 1rem;
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.btn-primary {
  background: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
  flex: 1;
}

.btn-primary:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-secondary {
  background: #1a1a1a;
  color: white;
  border: 1px solid #2a2a2a;
  padding: 0.5rem;
  min-width: 40px;
}

.btn-secondary:hover {
  background: #2a2a2a;
  border-color: #3a3a3a;
}

.btn-icon {
  font-size: 1rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .streams-grid {
    grid-template-columns: 1fr;
  }
  
  .following-page {
    padding: 1rem;
  }
}
</style>
