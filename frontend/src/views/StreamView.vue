<template>
  <div class="stream-page">
    <!-- Основной контент -->
    <main class="stream-main">
      <div class="container">
        <!-- Загрузка -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Загрузка трансляции...</p>
        </div>

        <!-- Трансляция не найдена -->
        <div v-else-if="!stream" class="error-state">
          <div class="error-icon">❌</div>
          <h2>Трансляция не найдена</h2>
          <p>Запрашиваемая трансляция не существует или была удалена.</p>
          <button @click="goBack" class="btn btn-primary">
            Вернуться к списку
          </button>
        </div>

        <!-- Трансляция завершена -->
        <div v-else-if="!stream.is_active" class="ended-state">
          <div class="ended-icon">⏹️</div>
          <h2>Трансляция завершена</h2>
          <p>Эта трансляция была завершена оператором.</p>
          <button @click="goBack" class="btn btn-primary">
            Вернуться к списку
          </button>
        </div>

        <!-- Активная трансляция -->
        <div v-else class="stream-content">
          <div class="video-section">
            <!-- Заголовок трансляции -->
            <div class="stream-header">
              <div class="stream-title-block">
                <h2 class="stream-title">{{ stream.title }}</h2>
                <p v-if="stream.description" class="stream-description">{{ stream.description }}</p>
              </div>
              <button 
                v-if="canViewViewers"
                @click="showViewersModal = true"
                class="viewers-button"
                :title="'Просмотр списка зрителей'"
              >
                <span class="viewers-icon">👥</span>
                <span class="viewers-count">{{ stream.viewer_count || 0 }}</span>
              </button>
            </div>

            <div class="video-container">
              <HLSPlayer 
                :streamName="stream.stream_key || stream.id"
                :streamTitle="stream.title"
                @error="onStreamError"
                @canplay="onStreamReady"
              />
              <div v-if="!isConnected" class="video-overlay">
                <div class="overlay-content">
                  <div class="overlay-icon">📺</div>
                  <h3>Подключение к трансляции</h3>
                  <p>Ожидание начала трансляции оператором...</p>
                  <div class="loading-spinner"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-section">
            <div class="chat-header">
              <h3>Чат трансляции</h3>
              <span class="chat-count">{{ chatMessages.length }} сообщений</span>
            </div>
            
            <div class="chat-messages" ref="chatMessages">
              <div 
                v-for="message in chatMessages" 
                :key="message.id"
                :class="['chat-message', `message-${message.message_type}`]"
              >
                <div class="message-header">
                  <span 
                    class="message-user" 
                    :style="{ color: getUserColorForMessage(message) }"
                  >
                    {{ message.user?.username || message.user?.email || 'Пользователь' }}
                  </span>
                  <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                </div>
                <div class="message-content">{{ message.message }}</div>
              </div>
            </div>
            
            <div class="chat-input">
              <input
                v-model="newMessage"
                type="text"
                class="form-input"
                placeholder="Введите сообщение..."
                @keyup.enter="sendMessage"
                :disabled="isLoading"
              />
              <button 
                @click="sendMessage"
                class="btn btn-primary"
                :disabled="!newMessage.trim() || isLoading"
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Модальное окно со списком зрителей -->
    <ViewersModal 
      :show="showViewersModal"
      :streamId="parseInt(route.params.id)"
      @close="showViewersModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useStreamStore } from '@/store/stream'
import { useToast } from 'vue-toastification'
import HLSPlayer from '@/components/HLSPlayer.vue'
import ViewersModal from '@/components/ViewersModal.vue'
import { getUserColor } from '@/utils/userColors'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const streamStore = useStreamStore()
const toast = useToast()

// Состояние модального окна зрителей
const showViewersModal = ref(false)

// Props
const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

// Состояние
const stream = ref(null)
const isLoading = ref(false)
const isConnected = ref(false)
const viewerCount = ref(0)
const newMessage = ref('')
// remoteVideo больше не нужен для HLS

// Проверка прав на просмотр списка зрителей (только операторы и админы)
const canViewViewers = computed(() => {
  return authStore.user && (authStore.user.role === 'operator' || authStore.user.role === 'admin')
})
const chatMessagesRef = ref(null)

// Используем сообщения из store
const chatMessages = computed(() => {
  if (!stream.value) return []
  
  return streamStore.chatMessages.filter(msg => 
    msg.stream_id === stream.value.id
  )
})

// Обработчики
const goBack = () => {
  router.push('/dashboard')
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const loadStream = async () => {
  try {
    isLoading.value = true
    const streamData = await streamStore.fetchStream(props.id)
    stream.value = streamData
    
    if (streamData && streamData.is_active) {
      // Присоединение к трансляции
      streamStore.joinStream(streamData.id)
      
      // Загрузка сообщений чата
      await fetchChatMessages(streamData.id)
      
      // Инициализация стрима
      await initializeStream()
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки трансляции:', error)
    toast.error('Ошибка загрузки трансляции')
  } finally {
    isLoading.value = false
  }
}

const initializeStream = async () => {
  try {
    // WebRTC функции отключены, используем HLS
    console.log('📺 Используется HLS стриминг')
    
    // Просто отмечаем как подключенных
    isConnected.value = true
  } catch (error) {
    console.error('❌ Ошибка подключения к трансляции:', error)
    toast.error('Ошибка подключения к трансляции')
  }
}

const fetchChatMessages = async (streamId) => {
  try {
    await streamStore.fetchChatMessages(streamId)
  } catch (error) {
    console.error('❌ Ошибка загрузки сообщений чата:', error)
  }
}

const sendMessage = () => {
  if (!newMessage.value.trim() || !stream.value) return

  streamStore.sendChatMessage(stream.value.id, newMessage.value)
  newMessage.value = ''
}

const onStreamError = (error) => {
  console.error('❌ Ошибка стрима:', error)
  toast.error('Ошибка воспроизведения стрима')
}

const onStreamReady = () => {
  console.log('✅ Стрим готов к воспроизведению')
  isConnected.value = true
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getUserColorForMessage = (message) => {
  const userId = message.user?.id || message.user?.email || message.user_email
  return getUserColor(userId)
}

const scrollChatToBottom = () => {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
}

// Подписка на сообщения чата
const unsubscribeChat = streamStore.$subscribe((mutation, state) => {
  if (mutation.type === 'direct' && mutation.events) {
    const event = mutation.events.find(e => e.key === 'currentStreamMessages')
    if (event) {
      chatMessages.value = event.newValue
      scrollChatToBottom()
    }
  }
})

// Отслеживание изменений ID трансляции
watch(() => props.id, (newId) => {
  if (newId) {
    loadStream()
  }
}, { immediate: true })

// Инициализация
onMounted(() => {
  if (props.id) {
    loadStream()
  }
})

onUnmounted(async () => {
  // Покидание трансляции при размонтировании
  if (stream.value) {
    streamStore.leaveStream(stream.value.id)
  }
  
  // WebRTC больше не используется
  
  if (unsubscribeChat) {
    unsubscribeChat()
  }
})
</script>

<style scoped>
.stream-page {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 0;
}

.stream-header {
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid #334155;
  padding: 1rem 0;
  backdrop-filter: blur(10px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stream-title h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.stream-title p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  margin: 0.25rem 0 0 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stream-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.viewer-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
}

.icon {
  font-size: 1rem;
}

.status-live {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #ef4444;
  font-weight: 600;
  font-size: 0.875rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 1rem;
}

.stream-main {
  padding: 0;
  height: calc(100vh - 60px);
}

.container {
  max-width: none;
  margin: 0;
  padding: 0;
  height: 100%;
}

.loading-state,
.error-state,
.ended-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
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

.error-icon,
.ended-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-state h2,
.ended-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.error-state p,
.ended-state p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.stream-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0;
  height: 100%;
}

.video-section {
  background: #0f0f0f;
  border: none;
  border-radius: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.video-container {
  position: relative;
  width: 100%;
  flex: 1;
  background: #000;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

.overlay-content {
  text-align: center;
  color: white;
}

.overlay-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.overlay-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.overlay-content p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
}

.chat-section {
  background: #1a1a1a;
  border: none;
  border-left: 1px solid #2a2a2a;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.chat-count {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.chat-messages {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  max-height: none;
}

.chat-message {
  margin-bottom: 0.5rem;
  padding: 0.5rem 0;
  border-radius: 0;
  background: transparent;
  border: none;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
  gap: 0.5rem;
}

.message-user {
  font-weight: 600;
  font-size: 0.875rem;
}

.message-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.message-content {
  color: white;
  font-size: 0.875rem;
  line-height: 1.4;
  margin-left: 0;
}

.message-system {
  background: rgba(245, 158, 11, 0.2);
  border-left: 3px solid #f59e0b;
}

.message-admin {
  background: rgba(139, 92, 246, 0.2);
  border-left: 3px solid #8b5cf6;
}

.chat-input {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.form-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #2a2a2a;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #ff0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .stream-content {
    grid-template-columns: 1fr;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-right {
    width: 100%;
    justify-content: space-between;
  }
  
  .video-container {
    height: 300px;
  }
  
  .stream-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .viewers-button {
    width: 100%;
    justify-content: center;
  }
}

/* Стили для заголовка трансляции и кнопки зрителей */
.stream-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.stream-title-block {
  flex: 1;
  min-width: 0;
}

.stream-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.25rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-description {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.viewers-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, rgba(83, 252, 24, 0.15) 0%, rgba(0, 212, 170, 0.15) 100%);
  border: 1px solid rgba(83, 252, 24, 0.3);
  border-radius: 12px;
  color: #53fc18;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.viewers-button:hover {
  background: linear-gradient(135deg, rgba(83, 252, 24, 0.25) 0%, rgba(0, 212, 170, 0.25) 100%);
  border-color: #53fc18;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 252, 24, 0.3);
}

.viewers-button:active {
  transform: translateY(0);
}

.viewers-icon {
  font-size: 1.25rem;
}

.viewers-count {
  font-size: 1.125rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}
</style>
