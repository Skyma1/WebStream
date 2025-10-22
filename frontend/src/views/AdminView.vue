<template>
  <div class="admin-page">
    <main class="admin-main">
      <div class="container">
        <!-- Заголовок -->
        <div class="admin-header">
          <h1>Панель администратора</h1>
          <p>Управление системой, пользователями и трансляциями</p>
        </div>

        <!-- Табы -->
        <div class="admin-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            class="tab-button"
            :class="{ 'active': activeTab === tab.id }"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- Контент табов -->
        <div class="tab-content">
          <!-- Статистика -->
          <div v-if="activeTab === 'stats'" class="tab-panel">
            <div class="stats-section">
              <h2>Статистика системы</h2>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-icon">👥</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
                    <div class="stat-label">Всего пользователей</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">📺</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ stats.totalStreams || 0 }}</div>
                    <div class="stat-label">Всего трансляций</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">🔴</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ stats.activeStreams || 0 }}</div>
                    <div class="stat-label">Активных трансляций</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">🔑</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ stats.totalCodes || 0 }}</div>
                    <div class="stat-label">Всего кодов</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Управление пользователями -->
          <div v-if="activeTab === 'users'" class="tab-panel">
            <div class="users-section">
              <div class="section-header">
                <h2>Управление пользователями</h2>
                <div class="section-actions">
                  <button @click="refreshUsers" class="btn btn-secondary btn-sm">
                    <span class="btn-icon">🔄</span>
                    Обновить
                  </button>
                </div>
              </div>
              
              <div class="users-table-container">
                <table class="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
                      <th>Никнейм</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th>Дата регистрации</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id">
                      <td>{{ user.id }}</td>
                      <td>{{ user.email }}</td>
                      <td>{{ user.username || 'Не указан' }}</td>
                      <td>
                        <span class="role-badge" :class="`role-${user.role}`">
                          {{ getRoleText(user.role) }}
                        </span>
                      </td>
                      <td>
                        <span class="status-badge" :class="{ 'active': user.is_active }">
                          {{ user.is_active ? 'Активен' : 'Заблокирован' }}
                        </span>
                      </td>
                      <td>{{ formatDate(user.created_at) }}</td>
                      <td>
                        <div class="action-buttons">
                          <button 
                            @click="toggleUserStatus(user)"
                            class="btn btn-sm"
                            :class="user.is_active ? 'btn-warning' : 'btn-success'"
                          >
                            {{ user.is_active ? 'Заблокировать' : 'Разблокировать' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Управление трансляциями -->
          <div v-if="activeTab === 'streams'" class="tab-panel">
            <div class="streams-section">
              <div class="section-header">
                <h2>Управление трансляциями</h2>
                <div class="section-actions">
                  <button @click="refreshStreams" class="btn btn-secondary btn-sm">
                    <span class="btn-icon">🔄</span>
                    Обновить
                  </button>
                </div>
              </div>
              
              <div class="streams-table-container">
                <table class="streams-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Название</th>
                      <th>Оператор</th>
                      <th>Статус</th>
                      <th>Зрители</th>
                      <th>Начало</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="stream in adminStreams" :key="stream.id">
                      <td>{{ stream.id }}</td>
                      <td>{{ stream.title }}</td>
                      <td>{{ stream.operator_username || stream.operator_email }}</td>
                      <td>
                        <span class="status-badge" :class="{ 'active': stream.is_active }">
                          {{ stream.is_active ? 'Активна' : 'Завершена' }}
                        </span>
                      </td>
                      <td>{{ stream.viewer_count || 0 }}</td>
                      <td>{{ formatDate(stream.started_at) }}</td>
                      <td>
                        <div class="action-buttons">
                          <button 
                            v-if="stream.is_active"
                            @click="endStream(stream.id)"
                            class="btn btn-sm btn-error"
                          >
                            Завершить
                          </button>
                          <button 
                            @click="viewStream(stream.id)"
                            class="btn btn-sm btn-secondary"
                          >
                            Просмотр
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Управление кодами -->
          <div v-if="activeTab === 'codes'" class="tab-panel">
            <div class="codes-section">
              <div class="section-header">
                <h2>Управление кодами регистрации</h2>
                <div class="section-actions">
                  <button @click="refreshCodes" class="btn btn-secondary btn-sm">
                    <span class="btn-icon">🔄</span>
                    Обновить
                  </button>
                </div>
              </div>

              <!-- Создание нового кода -->
              <div class="create-code-section">
                <h3>Создать новый код</h3>
                <div class="create-code-form">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="role" class="form-label">Роль</label>
                      <select 
                        id="role"
                        v-model="newCode.role"
                        class="form-select"
                      >
                        <option value="viewer">Зритель</option>
                        <option value="operator">Оператор</option>
                        <option value="admin">Администратор</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="expiresAt" class="form-label">Срок действия</label>
                      <input
                        id="expiresAt"
                        v-model="newCode.expiresAt"
                        type="datetime-local"
                        class="form-input"
                      />
                    </div>
                    <div class="form-group">
                      <label for="maxUses" class="form-label">Максимум использований</label>
                      <input
                        id="maxUses"
                        v-model="newCode.maxUses"
                        type="number"
                        min="1"
                        class="form-input"
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div class="form-actions">
                    <button 
                      @click="createCode" 
                      class="btn btn-primary"
                      :disabled="isCreatingCode"
                    >
                      <span v-if="isCreatingCode" class="loading-spinner-small"></span>
                      {{ isCreatingCode ? 'Создание...' : 'Создать код' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Список кодов -->
              <div class="codes-table-container">
                <table class="codes-table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Роль</th>
                      <th>Использований</th>
                      <th>Максимум</th>
                      <th>Создан</th>
                      <th>Истекает</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="code in codes" :key="code.id">
                      <td>
                        <code class="code-value">{{ code.code }}</code>
                      </td>
                      <td>
                        <span class="role-badge" :class="`role-${code.role}`">
                          {{ getRoleText(code.role) }}
                        </span>
                      </td>
                      <td>{{ code.used_count || 0 }}</td>
                      <td>{{ code.max_uses || '∞' }}</td>
                      <td>{{ formatDate(code.created_at) }}</td>
                      <td>{{ formatDate(code.expires_at) }}</td>
                      <td>
                        <span class="status-badge" :class="{ 'active': isCodeActive(code) }">
                          {{ isCodeActive(code) ? 'Активен' : 'Истек' }}
                        </span>
                      </td>
                      <td>
                        <div class="action-buttons">
                          <button 
                            @click="copyCode(code.code)"
                            class="btn btn-sm btn-secondary"
                          >
                            Копировать
                          </button>
                          <button 
                            @click="deleteCode(code.id)"
                            class="btn btn-sm btn-error"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useToast } from 'vue-toastification'
import apiService from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// Состояние
const activeTab = ref('stats')
const isLoading = ref(false)
const isCreatingCode = ref(false)

// Данные
const stats = ref({
  totalUsers: 0,
  totalStreams: 0,
  activeStreams: 0,
  totalCodes: 0
})

const users = ref([])
const adminStreams = ref([])
const codes = ref([])

// Форма создания кода
const newCode = ref({
  role: 'viewer',
  expiresAt: '',
  maxUses: 1
})

// Табы
const tabs = [
  { id: 'stats', label: 'Статистика', icon: '📊' },
  { id: 'users', label: 'Пользователи', icon: '👥' },
  { id: 'streams', label: 'Трансляции', icon: '📺' },
  { id: 'codes', label: 'Коды', icon: '🔑' }
]

// Computed
const isCodeActive = (code) => {
  if (code.max_uses && code.used_count >= code.max_uses) return false
  if (code.expires_at && new Date(code.expires_at) < new Date()) return false
  return true
}

// Methods
const getRoleText = (role) => {
  const roles = {
    admin: 'Администратор',
    operator: 'Оператор',
    viewer: 'Зритель'
  }
  return roles[role] || role
}

const formatDate = (dateString) => {
  if (!dateString) return 'Не указано'
  return new Date(dateString).toLocaleString('ru-RU')
}

const loadStats = async () => {
  try {
    const [usersRes, streamsRes, codesRes] = await Promise.all([
      apiService.get('/admin/users'),
      apiService.get('/admin/streams'),
      apiService.get('/admin/codes')
    ])
    
    stats.value = {
      totalUsers: usersRes.data.length,
      totalStreams: streamsRes.data.length,
      activeStreams: streamsRes.data.filter(s => s.is_active).length,
      totalCodes: codesRes.data.length
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки статистики:', error)
    toast.error('Ошибка загрузки статистики')
  }
}

const loadUsers = async () => {
  try {
    const response = await apiService.get('/admin/users')
    users.value = response.data
  } catch (error) {
    console.error('❌ Ошибка загрузки пользователей:', error)
    toast.error('Ошибка загрузки пользователей')
  }
}

const loadStreams = async () => {
  try {
    const response = await apiService.get('/admin/streams')
    adminStreams.value = response.data
  } catch (error) {
    console.error('❌ Ошибка загрузки трансляций:', error)
    toast.error('Ошибка загрузки трансляций')
  }
}

const loadCodes = async () => {
  try {
    const response = await apiService.get('/admin/codes')
    codes.value = response.data
  } catch (error) {
    console.error('❌ Ошибка загрузки кодов:', error)
    toast.error('Ошибка загрузки кодов')
  }
}

const refreshUsers = () => {
  loadUsers()
  toast.info('Список пользователей обновлен')
}

const refreshStreams = () => {
  loadStreams()
  toast.info('Список трансляций обновлен')
}

const refreshCodes = () => {
  loadCodes()
  toast.info('Список кодов обновлен')
}

const toggleUserStatus = async (user) => {
  try {
    await apiService.patch(`/admin/users/${user.id}/toggle`)
    user.is_active = !user.is_active
    toast.success(`Пользователь ${user.is_active ? 'разблокирован' : 'заблокирован'}`)
  } catch (error) {
    console.error('❌ Ошибка изменения статуса пользователя:', error)
    toast.error('Ошибка изменения статуса пользователя')
  }
}

const endStream = async (streamId) => {
  try {
    await apiService.patch(`/admin/streams/${streamId}/end`)
    const stream = adminStreams.value.find(s => s.id === streamId)
    if (stream) {
      stream.is_active = false
      stream.ended_at = new Date().toISOString()
    }
    toast.success('Трансляция завершена')
  } catch (error) {
    console.error('❌ Ошибка завершения трансляции:', error)
    toast.error('Ошибка завершения трансляции')
  }
}

const viewStream = (streamId) => {
  router.push(`/stream/${streamId}`)
}

const createCode = async () => {
  if (isCreatingCode.value) return
  
  try {
    isCreatingCode.value = true
    
    const codeData = {
      role: newCode.value.role,
      expires_at: newCode.value.expiresAt || null,
      max_uses: newCode.value.maxUses || null
    }
    
    const response = await apiService.post('/admin/codes', codeData)
    codes.value.unshift(response.data)
    
    // Сброс формы
    newCode.value = {
      role: 'viewer',
      expiresAt: '',
      maxUses: 1
    }
    
    toast.success('Код создан успешно')
  } catch (error) {
    console.error('❌ Ошибка создания кода:', error)
    const errorMessage = error.response?.data?.error || 'Ошибка создания кода'
    toast.error(errorMessage)
  } finally {
    isCreatingCode.value = false
  }
}

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Код скопирован в буфер обмена')
  } catch (error) {
    console.error('❌ Ошибка копирования:', error)
    toast.error('Ошибка копирования кода')
  }
}

const deleteCode = async (codeId) => {
  if (!confirm('Вы уверены, что хотите удалить этот код?')) return
  
  try {
    await apiService.delete(`/admin/codes/${codeId}`)
    codes.value = codes.value.filter(c => c.id !== codeId)
    toast.success('Код удален')
  } catch (error) {
    console.error('❌ Ошибка удаления кода:', error)
    toast.error('Ошибка удаления кода')
  }
}

// Lifecycle
onMounted(async () => {
  try {
    await loadStats()
    await loadUsers()
    await loadStreams()
    await loadCodes()
  } catch (error) {
    console.error('❌ Ошибка инициализации админки:', error)
  }
})
</script>

<style scoped>
.admin-page {
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
  color: white;
  padding: 2rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.admin-header {
  text-align: center;
  margin-bottom: 3rem;
}

.admin-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: white;
}

.admin-header p {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

/* Табы */
.admin-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #2a2a2a;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
  font-size: 0.875rem;
  font-weight: 500;
}

.tab-button:hover {
  color: white;
  background: rgba(255, 255, 255, 0.05);
}

.tab-button.active {
  color: #ff0000;
  border-bottom-color: #ff0000;
  background: rgba(255, 0, 0, 0.05);
}

.tab-icon {
  font-size: 1.125rem;
}

.tab-label {
  white-space: nowrap;
}

/* Контент табов */
.tab-content {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 2rem;
}

.tab-panel {
  min-height: 400px;
}

/* Статистика */
.stats-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Заголовки секций */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.section-actions {
  display: flex;
  gap: 1rem;
}

/* Таблицы */
.users-table-container,
.streams-table-container,
.codes-table-container {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  overflow: hidden;
}

.users-table,
.streams-table,
.codes-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.streams-table th,
.codes-table th {
  background: #3a3a3a;
  color: white;
  font-weight: 600;
  padding: 1rem;
  text-align: left;
  font-size: 0.875rem;
}

.users-table td,
.streams-table td,
.codes-table td {
  padding: 1rem;
  border-bottom: 1px solid #3a3a3a;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
}

.users-table tr:hover,
.streams-table tr:hover,
.codes-table tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Бейджи */
.role-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.role-admin {
  background: #ff0000;
  color: white;
}

.role-operator {
  background: #ff6b35;
  color: white;
}

.role-viewer {
  background: #4a90e2;
  color: white;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #6b7280;
  color: white;
}

.status-badge.active {
  background: #10b981;
  color: white;
}

/* Код */
.code-value {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #ff0000;
}

/* Кнопки действий */
.action-buttons {
  display: flex;
  gap: 0.5rem;
}

/* Форма создания кода */
.create-code-section {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.create-code-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: white;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  margin-bottom: 0.5rem;
}

.form-input,
.form-select {
  padding: 0.75rem;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #1a1a1a;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #ff0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-actions {
  display: flex;
  gap: 1rem;
}

/* Кнопки */
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

.btn-success {
  background: #10b981;
  color: white;
  border: 1px solid #10b981;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.btn-warning {
  background: #f59e0b;
  color: white;
  border: 1px solid #f59e0b;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
  border-color: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
}

.btn-error {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
}

.btn-error:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4);
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 1rem;
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

/* Адаптивность */
@media (max-width: 768px) {
  .admin-page {
    padding: 1rem;
  }
  
  .admin-header h1 {
    font-size: 2rem;
  }
  
  .admin-tabs {
    flex-wrap: wrap;
  }
  
  .tab-button {
    padding: 0.75rem 1rem;
  }
  
  .tab-content {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .users-table-container,
  .streams-table-container,
  .codes-table-container {
    overflow-x: auto;
  }
}
</style>