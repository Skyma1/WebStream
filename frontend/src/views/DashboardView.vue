<template>
  <div class="dashboard">
    <!-- Основной контент -->
    <main class="dashboard-main">
      <div class="container">
        <!-- Загрузка -->
        <div v-if="streamStore.isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Загрузка трансляций...</p>
        </div>

        <!-- Список трансляций -->
        <div v-else-if="streamStore.activeStreams.length > 0" class="streams-section">
          <div class="streams-header">
            <h2>Активные трансляции</h2>
            <div class="multiscreen-controls">
              <router-link to="/multiscreen" class="btn btn-secondary">Мультискрин</router-link>
            </div>
          </div>
          <div class="streams-grid">
            <div 
              v-for="stream in streamStore.activeStreams" 
              :key="stream.id"
              class="stream-card"
            >
              <div class="stream-preview" @click="joinStream(stream.id)">
                <div class="stream-placeholder">
                  <span class="stream-icon">📺</span>
                </div>
                <div class="stream-status">
                  <span class="status-dot"></span>
                  LIVE
                </div>
              </div>
              <div class="stream-info">
                <h3 class="stream-title">{{ stream.title }}</h3>
                <p class="stream-description">{{ stream.description || 'Без описания' }}</p>
                <div class="stream-meta">
                  <span class="stream-operator">👤 {{ stream.operator_username || stream.operator_email }}</span>
                  <span class="stream-viewers">👥 {{ stream.viewer_count || 0 }}</span>
                </div>
                <div class="stream-actions">
                  <button 
                    @click.stop="joinStream(stream.id)"
                    class="btn btn-primary btn-sm"
                  >
                    <span class="btn-icon">▶️</span>
                    Смотреть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Пустое состояние -->
        <div v-else class="empty-state">
          <div class="empty-icon">📺</div>
          <h2>Нет активных трансляций</h2>
          <p>В данный момент нет доступных трансляций для просмотра.</p>
          <button @click="refreshStreams" class="btn btn-primary">
            <span class="btn-icon">🔄</span>
            Обновить
          </button>
        </div>

      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useStreamStore } from '@/store/stream'

const router = useRouter()
const authStore = useAuthStore()
const streamStore = useStreamStore()

// Обработчики
const joinStream = (streamId) => {
  router.push(`/stream/${streamId}`)
}

const refreshStreams = async () => {
  try {
    await streamStore.fetchStreams()
  } catch (error) {
    console.error('❌ Ошибка обновления трансляций:', error)
  }
}

// Инициализация
onMounted(async () => {
  try {
    await streamStore.fetchStreams()
  } catch (error) {
    console.error('❌ Ошибка загрузки трансляций:', error)
  }
})
</script>

<style scoped>
.dashboard {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 2rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
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

.btn-secondary {
  background: #1a1a1a;
  color: white;
  border: 1px solid #2a2a2a;
}

.btn-secondary:hover {
  background: #2a2a2a;
  border-color: #3a3a3a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-primary {
  background: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
}

.btn-primary:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

.btn-error {
  background: #ef4444;
  color: white;
}

.btn-icon {
  font-size: 1rem;
}

.dashboard-main {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.streams-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: white;
}

.streams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.stream-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.stream-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  border-color: #3a3a3a;
}

.stream-preview {
  position: relative;
  height: 200px;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stream-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.6);
}

.stream-icon {
  font-size: 3rem;
}

.stream-status {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: #ff0000;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
}

.status-dot {
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

.stream-info {
  padding: 1.5rem;
}

.stream-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: white;
}

.stream-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.stream-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.empty-state {
  text-align: center;
  padding: 4rem 0;
  background: transparent;
  border: none;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}


@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-right {
    width: 100%;
    justify-content: flex-end;
  }
  
  .streams-grid {
    grid-template-columns: 1fr;
  }
}

.streams-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.streams-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
}

.multiscreen-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.stream-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.stream-actions .btn {
  flex: 1;
  justify-content: center;
}
</style>
