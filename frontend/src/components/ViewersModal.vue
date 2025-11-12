<template>
  <transition name="modal">
    <div v-if="show" class="modal-overlay" @click="closeModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>👥 Зрители трансляции</h3>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <!-- Загрузка -->
          <div v-if="isLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Загрузка списка зрителей...</p>
          </div>

          <!-- Ошибка -->
          <div v-else-if="error" class="error-state">
            <div class="error-icon">❌</div>
            <p>{{ error }}</p>
            <button @click="loadViewers" class="btn btn-secondary">
              Попробовать снова
            </button>
          </div>

          <!-- Список зрителей -->
          <div v-else-if="viewers.length > 0" class="viewers-list">
            <div class="viewers-count">
              <span>Всего зрителей: <strong>{{ viewers.length }}</strong></span>
            </div>

            <div 
              v-for="viewer in viewers" 
              :key="viewer.id"
              class="viewer-item"
            >
              <div class="viewer-avatar">
                {{ getInitials(viewer.username) }}
              </div>
              <div class="viewer-info">
                <div class="viewer-name">{{ viewer.username }}</div>
                <div class="viewer-role">
                  <span :class="['role-badge', `role-${viewer.role}`]">
                    {{ getRoleLabel(viewer.role) }}
                  </span>
                </div>
              </div>
              <div class="viewer-time">
                {{ getConnectionTime(viewer.connectedAt) }}
              </div>
            </div>
          </div>

          <!-- Пустой список -->
          <div v-else class="empty-state">
            <div class="empty-icon">👤</div>
            <p>Пока нет зрителей</p>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import apiService from '@/services/api'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  streamId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['close'])

const viewers = ref([])
const isLoading = ref(false)
const error = ref(null)

// Загрузка списка зрителей
const loadViewers = async () => {
  if (!props.streamId) return

  isLoading.value = true
  error.value = null

  try {
    const response = await apiService.get(`/streams/${props.streamId}/viewers`)
    viewers.value = response.data.viewers || []
  } catch (err) {
    console.error('❌ Ошибка загрузки зрителей:', err)
    error.value = err.response?.data?.error || 'Не удалось загрузить список зрителей'
  } finally {
    isLoading.value = false
  }
}

// Закрытие модального окна
const closeModal = () => {
  emit('close')
}

// Получение инициалов
const getInitials = (username) => {
  if (!username) return '?'
  return username.substring(0, 2).toUpperCase()
}

// Получение метки роли
const getRoleLabel = (role) => {
  const labels = {
    admin: 'Администратор',
    operator: 'Оператор',
    viewer: 'Зритель'
  }
  return labels[role] || role
}

// Форматирование времени подключения
const getConnectionTime = (connectedAt) => {
  if (!connectedAt) return 'только что'
  
  const now = new Date()
  const connected = new Date(connectedAt)
  const diffMs = now - connected
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин назад`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} ч назад`
  
  return connected.toLocaleDateString('ru-RU')
}

// Автоматическая загрузка при открытии
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadViewers()
  } else {
    viewers.value = []
    error.value = null
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(83, 252, 24, 0.3);
  border-top: 3px solid #53fc18;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.viewers-count {
  background: rgba(83, 252, 24, 0.1);
  border: 1px solid rgba(83, 252, 24, 0.3);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  text-align: center;
  color: #53fc18;
  font-size: 0.875rem;
}

.viewers-count strong {
  font-size: 1.25rem;
  font-weight: 700;
}

.viewers-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.viewer-item {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s;
}

.viewer-item:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: #53fc18;
  transform: translateX(4px);
}

.viewer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #53fc18 0%, #00d4aa 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.125rem;
  color: #000;
  flex-shrink: 0;
}

.viewer-info {
  flex: 1;
  min-width: 0;
}

.viewer-name {
  font-weight: 600;
  color: white;
  font-size: 1rem;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-role {
  display: flex;
  gap: 0.5rem;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.role-admin {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.role-operator {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.role-viewer {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.viewer-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #334155;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(51, 65, 85, 0.8);
  color: white;
  border: 1px solid #475569;
}

.btn-secondary:hover {
  background: rgba(71, 85, 105, 0.8);
  transform: translateY(-1px);
}

/* Анимация появления/исчезновения */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Скроллбар */
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(83, 252, 24, 0.3);
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(83, 252, 24, 0.5);
}

@media (max-width: 640px) {
  .modal-container {
    max-height: 90vh;
    margin: 1rem;
  }

  .modal-header h3 {
    font-size: 1.25rem;
  }

  .viewer-item {
    padding: 0.75rem;
  }

  .viewer-avatar {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }
}
</style>

