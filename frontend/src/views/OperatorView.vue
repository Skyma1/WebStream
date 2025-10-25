<template>
  <div class="operator-page">
    <!-- Основной контент -->
    <main class="operator-main">
      <div class="container">
        <!-- Создание трансляции -->
        <div v-if="!currentStream" class="create-stream-section">
          <div class="create-stream-card">
            <h2>Начать трансляцию</h2>
            <p>Создайте новую трансляцию для зрителей</p>
            
            <form @submit.prevent="createStream" class="create-stream-form">
              <div class="form-group">
                <label for="title" class="form-label">Название трансляции</label>
                <input
                  id="title"
                  v-model="streamForm.title"
                  type="text"
                  class="form-input"
                  placeholder="Введите название трансляции"
                  required
                  :disabled="isLoading"
                />
              </div>
              <div class="form-group">
                <label for="description" class="form-label">Описание (опционально)</label>
                <textarea
                  id="description"
                  v-model="streamForm.description"
                  class="form-input"
                  placeholder="Краткое описание трансляции"
                  rows="3"
                  :disabled="isLoading"
                ></textarea>
              </div>
              <button type="submit" class="btn btn-primary" :disabled="isLoading">
                <span class="btn-icon">▶️</span>
                {{ isLoading ? 'Создание...' : 'Создать трансляцию' }}
              </button>
            </form>
          </div>
        </div>

        <!-- Активная трансляция -->
        <div v-else class="stream-section">
          <div class="stream-info-card">
            <h2>{{ currentStream.title }}</h2>
            <p class="stream-description">{{ currentStream.description || 'Без описания' }}</p>
            
            <!-- RTMP настройки для OBS -->
            <div class="rtmp-settings">
              <h3>Настройки OBS Studio</h3>
              <div class="settings-grid">
                <div class="setting-item">
                  <label>Сервер:</label>
                  <div class="setting-value">
                    <code>rtmp://151.241.228.125:1935/live</code>
                    <button @click="copyToClipboard('rtmp://127.0.0.1:1935/live')" class="copy-btn">📋</button>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Ключ потока:</label>
                  <div class="setting-value">
                    <code>{{ currentStream.stream_key || currentStream.id }}</code>
                    <button @click="copyToClipboard(currentStream.stream_key || currentStream.id)" class="copy-btn">📋</button>
                  </div>
                </div>
              </div>
              
              <div class="obs-instructions">
                <h4>Инструкция для OBS:</h4>
                <ol>
                  <li>Откройте OBS Studio</li>
                  <li>Перейдите в Настройки → Поток</li>
                  <li>Выберите "Пользовательский..." в разделе Сервис</li>
                  <li>Введите сервер: <code>rtmp://127.0.0.1:1935/live</code></li>
                  <li>Введите ключ потока: <code>{{ currentStream.stream_key || currentStream.id }}</code></li>
                  <li>Нажмите "ОК" и "Начать трансляцию"</li>
                </ol>
              </div>
            </div>
          </div>

          <!-- Предварительный просмотр -->
          <div class="preview-section">
            <h3>Предварительный просмотр</h3>
            <div class="preview-container">
              <HLSPlayer 
                :streamName="currentStream.id"
                :streamTitle="currentStream.title"
                @error="onStreamError"
                @canplay="onStreamReady"
              />
            </div>
          </div>

          <!-- Чат трансляции -->
          <div class="chat-section">
            <div class="chat-header">
              <h3>Чат трансляции</h3>
            </div>
            <div class="chat-messages" ref="chatMessagesRef">
              <div v-for="message in chatMessages" :key="message.id" class="chat-message">
                <span 
                  class="message-author"
                  :style="{ color: getUserColorForMessage(message) }"
                >
                  {{ message.user?.username || message.user?.email || 'Неизвестный' }}:
                </span>
                <span class="message-text">{{ message.message }}</span>
                <span class="message-time">{{ new Date(message.timestamp || message.created_at).toLocaleTimeString('ru-RU') }}</span>
              </div>
              <div v-if="chatMessages.length === 0" class="empty-chat">
                <p>Пока нет сообщений. Начните общение!</p>
              </div>
            </div>
            <form @submit.prevent="sendChatMessage" class="chat-input-form">
              <input
                v-model="newChatMessage"
                type="text"
                placeholder="Написать сообщение..."
                class="form-input chat-input"
                :disabled="isLoading"
              />
              <button type="submit" class="btn btn-primary chat-send-btn" :disabled="isLoading || !newChatMessage.trim()">
                <span class="btn-icon">✉️</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useStreamStore } from '@/store/stream'
import { useToast } from 'vue-toastification'
import HLSPlayer from '@/components/HLSPlayer.vue'
import { getUserColor } from '@/utils/userColors'

const router = useRouter()
const authStore = useAuthStore()
const streamStore = useStreamStore()
const toast = useToast()

// Состояние
const currentStream = ref(null)
const isLoading = ref(false)
const streamForm = ref({
  title: '',
  description: ''
})
const newChatMessage = ref('')
const chatMessagesRef = ref(null)

// Используем сообщения из store
const chatMessages = computed(() => {
  console.log('🔍 Computed chatMessages вызван')
  console.log('📊 currentStream.value:', currentStream.value)
  console.log('📊 streamStore.chatMessages:', streamStore.chatMessages)
  
  if (!currentStream.value) {
    console.log('❌ Нет currentStream, возвращаем пустой массив')
    return []
  }
  
  const filtered = streamStore.chatMessages.filter(msg => {
    console.log('🔍 Проверяем сообщение:', msg, 'stream_id:', msg.stream_id, 'currentStream.id:', currentStream.value.id)
    return msg.stream_id === currentStream.value.id
  })
  
  console.log('✅ Отфильтрованные сообщения:', filtered)
  return filtered
})

// Обработчики
const goToAdmin = () => {
  router.push('/admin')
}

const handleLogout = async () => {
  if (currentStream.value) {
    await endStream()
  }
  await authStore.logout()
  router.push('/login')
}

const createStream = async () => {
  if (!streamForm.value.title.trim()) {
    toast.error('Название трансляции не может быть пустым')
    return
  }

  try {
    isLoading.value = true
    const stream = await streamStore.createStream(streamForm.value)
    currentStream.value = stream
    
    // Присоединение к чату трансляции
    streamStore.joinStream(stream.id)
    
    toast.success('Трансляция создана! Настройте OBS Studio для начала стриминга.')
  } catch (error) {
    console.error('❌ Ошибка создания трансляции:', error)
    toast.error('Ошибка создания трансляции')
  } finally {
    isLoading.value = false
  }
}

const endStream = async () => {
  if (!currentStream.value) return

  try {
    isLoading.value = true
    await streamStore.endStream(currentStream.value.id)
    toast.info('Трансляция завершена')
    
    streamStore.clearCurrentStream()
    currentStream.value = null
    streamForm.value = { title: '', description: '' }
  } catch (error) {
    console.error('❌ Ошибка завершения трансляции:', error)
    
    // Проверяем тип ошибки
    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.error || 'Ошибка завершения трансляции'
      if (errorMessage.includes('уже завершена')) {
        toast.warning('Трансляция уже завершена')
        // Очищаем состояние даже если трансляция уже завершена
        streamStore.clearCurrentStream()
        currentStream.value = null
        streamForm.value = { title: '', description: '' }
      } else {
        toast.error(errorMessage)
      }
    } else {
      toast.error('Ошибка завершения трансляции')
    }
  } finally {
    isLoading.value = false
  }
}

const sendChatMessage = () => {
  if (!newChatMessage.value.trim() || !currentStream.value) return

  streamStore.sendChatMessage(currentStream.value.id, newChatMessage.value)
  newChatMessage.value = ''
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Скопировано в буфер обмена')
  } catch (error) {
    console.error('❌ Ошибка копирования:', error)
    toast.error('Ошибка копирования')
  }
}

const onStreamError = (error) => {
  console.error('❌ Ошибка стрима:', error)
  toast.error('Ошибка воспроизведения стрима')
}

const onStreamReady = () => {
  console.log('✅ Стрим готов к воспроизведению')
  toast.success('Стрим готов!')
}

const scrollChatToBottom = () => {
  if (chatMessagesRef.value) {
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
  }
}

const getUserColorForMessage = (message) => {
  const userId = message.user?.id || message.user?.email || message.user_email
  return getUserColor(userId)
}

// Инициализация
onMounted(async () => {
  // Попытка восстановить состояние трансляции из localStorage
  try {
    const restoredStream = await streamStore.restoreStreamState()
    if (restoredStream) {
      currentStream.value = restoredStream
      await fetchChatMessages(restoredStream.id)
      console.log('✅ Восстановлена трансляция оператора:', restoredStream.id)
    }
  } catch (error) {
    console.error('❌ Ошибка восстановления трансляции:', error)
  }
  
  // Загрузка текущей трансляции если есть (fallback)
  if (!currentStream.value && streamStore.currentStream) {
    currentStream.value = streamStore.currentStream
    await fetchChatMessages(streamStore.currentStream.id)
  }
})

onUnmounted(() => {
  // Очистка при размонтировании
  if (currentStream.value) {
    endStream()
  }
})
</script>

<style scoped>
.operator-page {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 0;
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
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.btn-primary {
  background: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
}

.btn-primary:hover:not(:disabled) {
  background: #3a3a3a;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-secondary {
  background: #1a1a1a;
  color: white;
  border: 1px solid #2a2a2a;
}

.btn-secondary:hover:not(:disabled) {
  background: #2a2a2a;
  border-color: #3a3a3a;
}

.btn-error {
  background: #ff0000;
  color: white;
  border: 1px solid #ff0000;
  font-weight: 600;
}

.btn-error:hover:not(:disabled) {
  background: #e60000;
  border-color: #e60000;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 0, 0, 0.3);
}

.btn-icon {
  font-size: 1.1rem;
}

.operator-main {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.create-stream-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.create-stream-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.create-stream-card h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.create-stream-card p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
}

.create-stream-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
  text-align: left;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: white;
  font-size: 0.875rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.5);
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.stream-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.stream-info-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1.5rem;
}

.stream-info-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.stream-description {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
}

.rtmp-settings {
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1.5rem;
}

.rtmp-settings h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: white;
}

.settings-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setting-item label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  min-width: 120px;
}

.setting-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.setting-value code {
  background: rgba(59, 130, 246, 0.2);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  color: #60a5fa;
  flex: 1;
}

.copy-btn {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid #3b82f6;
  color: #60a5fa;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(59, 130, 246, 0.3);
}

.obs-instructions {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 1rem;
}

.obs-instructions h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: white;
}

.obs-instructions ol {
  margin: 0;
  padding-left: 1.5rem;
  color: rgba(255, 255, 255, 0.8);
}

.obs-instructions li {
  margin-bottom: 0.5rem;
}

.obs-instructions code {
  background: rgba(59, 130, 246, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  color: #60a5fa;
}

.preview-section {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1.5rem;
}

.preview-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: white;
}

.preview-container {
  border-radius: 8px;
  overflow: hidden;
}

.chat-section {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.chat-messages {
  flex-grow: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 300px;
}

.chat-message {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  padding: 0.75rem;
  border-radius: 8px;
  word-wrap: break-word;
}

.message-author {
  font-weight: 600;
  margin-right: 0.5rem;
}

.message-text {
  color: white;
}

.message-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 0.5rem;
}

.empty-chat {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  padding: 1rem;
}

.chat-input-form {
  display: flex;
  padding: 1rem;
  gap: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-input {
  flex-grow: 1;
}

.chat-send-btn {
  width: auto;
  padding: 0.75rem 1rem;
}

/* Адаптивность */
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

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .setting-item label {
    min-width: auto;
  }

  .setting-value {
    width: 100%;
  }
}
</style>