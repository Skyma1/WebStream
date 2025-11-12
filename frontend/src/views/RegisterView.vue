<template>
  <div class="register-page">
    <div class="register-container">
      <div class="register-card">
        <div class="register-header">
          <h1>Регистрация</h1>
          <p>Введите данные для создания аккаунта</p>
        </div>

        <form @submit.prevent="handleRegister" class="register-form">
          <div class="form-group">
            <label for="username" class="form-label">Имя пользователя</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="form-input"
              placeholder="username"
              required
              :disabled="isLoading"
              minlength="3"
              maxlength="20"
              pattern="[a-zA-Z0-9_]+"
            />
            <div class="form-help">От 3 до 20 символов (только буквы, цифры и подчеркивания)</div>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Пароль</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="form-input"
              placeholder="••••••••"
              required
              :disabled="isLoading"
              minlength="6"
            />
            <div class="form-help">Минимум 6 символов</div>
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">Подтверждение пароля</label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              class="form-input"
              placeholder="••••••••"
              required
              :disabled="isLoading"
            />
            <div v-if="form.confirmPassword && form.password !== form.confirmPassword" class="form-error">
              Пароли не совпадают
            </div>
          </div>

          <div class="form-group">
            <label for="secretCode" class="form-label">Секретный код</label>
            <input
              id="secretCode"
              v-model="form.secretCode"
              type="text"
              class="form-input"
              placeholder="Введите секретный код"
              required
              :disabled="isLoading"
            />
            <div class="form-help">Получите код у администратора</div>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isLoading || !isFormValid"
          >
            <span v-if="isLoading" class="loading-spinner"></span>
            {{ isLoading ? 'Регистрация...' : 'Зарегистрироваться' }}
          </button>
        </form>

        <div class="register-footer">
          <p>Уже есть аккаунт?</p>
          <router-link to="/login" class="text-primary">
            Войти
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const router = useRouter()
const authStore = useAuthStore()

// Состояние формы
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  secretCode: ''
})

const isLoading = ref(false)

// Валидация формы
const isFormValid = computed(() => {
  const usernameValid = form.value.username && 
                        form.value.username.length >= 3 && 
                        form.value.username.length <= 20 &&
                        /^[a-zA-Z0-9_]+$/.test(form.value.username)
  return usernameValid &&
         form.value.password && 
         form.value.password.length >= 6 &&
         form.value.confirmPassword &&
         form.value.password === form.value.confirmPassword &&
         form.value.secretCode
})

// Обработка регистрации
const handleRegister = async () => {
  if (!isFormValid.value) return

  isLoading.value = true

  try {
    const result = await authStore.register({
      username: form.value.username,
      password: form.value.password,
      secretCode: form.value.secretCode
    })
    
    if (result.success) {
      // Перенаправление на главную страницу
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error)
  } finally {
    isLoading.value = false
  }
}

// Автозаполнение для демо
onMounted(() => {
  // Заполнение демо-данных для тестирования
  if (import.meta.env.DEV) {
    form.value.username = 'testuser'
    form.value.password = 'password123'
    form.value.confirmPassword = 'password123'
    form.value.secretCode = 'OPERATOR25'
  }
})
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  padding: 1rem;
}

.register-container {
  width: 100%;
  max-width: 400px;
}

.register-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.register-header {
  text-align: center;
  margin-bottom: 2rem;
}

.register-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.register-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.register-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
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
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
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

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-help {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.form-error {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #ef4444;
}

.btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  text-transform: none;
  letter-spacing: 0.025em;
  min-height: 2.75rem;
}

.btn-primary {
  background: linear-gradient(135deg, #53fc18 0%, #00d4aa 100%);
  color: #000;
  border: 1px solid transparent;
  box-shadow: 0 2px 8px rgba(83, 252, 24, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #4ae015 0%, #00c19e 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(83, 252, 24, 0.4);
}

.btn-primary:before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn-primary:hover:not(:disabled):before {
  left: 100%;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
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

.register-footer {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.register-footer p {
  margin-bottom: 0.5rem;
}

.text-primary {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.text-primary:hover {
  color: #60a5fa;
  text-decoration: underline;
}

.w-full {
  width: 100%;
}

@media (max-width: 480px) {
  .register-card {
    padding: 1.5rem;
  }
  
  .register-header h1 {
    font-size: 1.75rem;
  }
}
</style>
