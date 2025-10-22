<template>
  <div class="profile-page">
    <div class="profile-container">
      <!-- Заголовок -->
      <div class="profile-header">
      <h1>Профиль пользователя</h1>
        <p>Настройте свой профиль и личную информацию</p>
      </div>

      <!-- Основная информация -->
      <div class="profile-section">
        <div class="profile-avatar-section">
          <div class="avatar-container">
            <div class="avatar-preview" :style="{ backgroundColor: userColor }">
              <img 
                v-if="profileForm.avatar" 
                :src="profileForm.avatar" 
                :alt="profileForm.username || authStore.user?.email"
                class="avatar-image"
              />
              <span v-else class="avatar-initials">
                {{ getInitials(profileForm.username || authStore.user?.email) }}
              </span>
            </div>
            <button @click="triggerFileInput" class="avatar-upload-btn">
              <span class="upload-icon">📷</span>
              Изменить аватар
            </button>
            <input 
              ref="fileInput"
              type="file" 
              accept="image/*" 
              @change="handleAvatarUpload"
              style="display: none"
            />
          </div>
        </div>

        <div class="profile-form">
          <div class="form-group">
            <label for="username">Никнейм</label>
            <input
              id="username"
              v-model="profileForm.username"
              type="text"
              class="form-input"
              placeholder="Введите ваш никнейм (может содержать несколько слов)"
              maxlength="50"
            />
            <small class="form-hint">Может содержать пробелы и специальные символы</small>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="profileForm.email"
              type="email"
              class="form-input"
              disabled
            />
            <small class="form-hint">Email нельзя изменить</small>
          </div>

          <div class="form-group">
            <label for="description">Описание</label>
            <textarea
              id="description"
              v-model="profileForm.description"
              class="form-textarea"
              placeholder="Расскажите о себе..."
              maxlength="500"
              rows="4"
            ></textarea>
            <small class="form-hint">{{ profileForm.description.length }}/500 символов</small>
          </div>

          <div class="form-actions">
            <button 
              @click="saveProfile" 
              class="btn btn-primary"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="loading-spinner-small"></span>
              {{ isLoading ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
            <button 
              @click="resetForm" 
              class="btn btn-secondary"
              :disabled="isLoading"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      <!-- Статистика -->
      <div class="profile-stats">
        <h2>Статистика</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📺</div>
            <div class="stat-content">
              <div class="stat-number">{{ userStats.streamsCount }}</div>
              <div class="stat-label">Трансляций</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <div class="stat-number">{{ userStats.followersCount }}</div>
              <div class="stat-label">Подписчиков</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💬</div>
            <div class="stat-content">
              <div class="stat-number">{{ userStats.messagesCount }}</div>
              <div class="stat-label">Сообщений</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-content">
              <div class="stat-number">{{ formatJoinDate(authStore.user?.created_at) }}</div>
              <div class="stat-label">Дата регистрации</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useToast } from 'vue-toastification'
import { getUserColor } from '@/utils/userColors'

const authStore = useAuthStore()
const toast = useToast()

// Refs
const fileInput = ref(null)
const isLoading = ref(false)

// Форма профиля
const profileForm = ref({
  username: '',
  email: '',
  description: '',
  avatar: ''
})

// Статистика пользователя
const userStats = ref({
  streamsCount: 0,
  followersCount: 0,
  messagesCount: 0
})

// Computed
const userColor = computed(() => {
  const userId = authStore.user?.id || authStore.user?.email
  return getUserColor(userId)
})

// Methods
const getInitials = (name) => {
  if (!name) return '?'
  const words = name.split(' ')
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleAvatarUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Проверяем размер файла (максимум 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Размер файла не должен превышать 5MB')
    return
  }

  // Проверяем тип файла
  if (!file.type.startsWith('image/')) {
    toast.error('Пожалуйста, выберите изображение')
    return
  }

  // Создаем URL для предварительного просмотра
  const reader = new FileReader()
  reader.onload = (e) => {
    profileForm.value.avatar = e.target.result
  }
  reader.readAsDataURL(file)
}

const loadProfile = async () => {
  try {
    // Загружаем данные профиля
    const response = await fetch('/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const profileData = await response.json()
      profileForm.value = {
        username: profileData.username || '',
        email: profileData.email || authStore.user?.email || '',
        description: profileData.description || '',
        avatar: profileData.avatar || ''
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error)
    // Устанавливаем значения по умолчанию
    profileForm.value = {
      username: authStore.user?.username || '',
      email: authStore.user?.email || '',
      description: authStore.user?.description || '',
      avatar: authStore.user?.avatar || ''
    }
  }
}

const loadUserStats = async () => {
  try {
    const response = await fetch('/api/user/stats', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const stats = await response.json()
      userStats.value = stats
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
    // Устанавливаем значения по умолчанию
    userStats.value = {
      streamsCount: 0,
      followersCount: 0,
      messagesCount: 0
    }
  }
}

const saveProfile = async () => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        username: profileForm.value.username.trim(),
        description: profileForm.value.description.trim(),
        avatar: profileForm.value.avatar
      })
    })

    if (response.ok) {
      const updatedProfile = await response.json()
      
      // Обновляем данные в store
      authStore.updateUserProfile(updatedProfile)
      
      toast.success('Профиль успешно обновлен!')
    } else {
      const error = await response.json()
      toast.error(error.message || 'Ошибка при сохранении профиля')
    }
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error)
    toast.error('Ошибка при сохранении профиля')
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  loadProfile()
  toast.info('Форма сброшена')
}

const formatJoinDate = (dateString) => {
  if (!dateString) return 'Неизвестно'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadProfile()
  loadUserStats()
})
</script>

<style scoped>
.profile-page {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 2rem;
}

.profile-container {
  max-width: 800px;
  margin: 0 auto;
}

.profile-header {
  text-align: center;
  margin-bottom: 3rem;
}

.profile-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: white;
}

.profile-header p {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.profile-section {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.profile-avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.avatar-container {
  text-align: center;
}

.avatar-preview {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem auto;
  border: 3px solid #2a2a2a;
  overflow: hidden;
  position: relative;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
}

.avatar-upload-btn {
  background: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 auto;
}

.avatar-upload-btn:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.upload-icon {
  font-size: 1rem;
}

.profile-form {
  max-width: 500px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #2a2a2a;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #ff0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
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
}

.btn-primary {
  background: #ff0000;
  color: white;
  border: 1px solid #ff0000;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: #e60000;
  border-color: #e60000;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 0, 0, 0.4);
}

.btn-secondary {
  background: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
}

.btn-secondary:hover:not(:disabled) {
  background: #3a3a3a;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.profile-stats {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 2rem;
}

.profile-stats h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: white;
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.stat-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Адаптивность */
@media (max-width: 768px) {
  .profile-page {
    padding: 1rem;
  }
  
  .profile-header h1 {
    font-size: 2rem;
  }
  
  .profile-section {
    padding: 1.5rem;
  }
  
  .avatar-preview {
    width: 100px;
    height: 100px;
  }
  
  .avatar-initials {
    font-size: 2rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>