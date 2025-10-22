<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>Вход</h1>
          <p>Введите данные для входа в систему</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="form-input"
              placeholder="user@example.com"
              required
              :disabled="isLoading"
            />
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
            />
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
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isLoading || !isFormValid"
          >
            <span v-if="isLoading" class="loading-spinner"></span>
            {{ isLoading ? 'Вход...' : 'Войти' }}
          </button>
        </form>

        <div class="login-footer">
          <p>Нет аккаунта?</p>
          <router-link to="/register" class="text-primary">
            Зарегистрироваться
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useToast } from 'vue-toastification'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

// Состояние формы
const form = ref({
  email: '',
  password: '',
  secretCode: ''
})

const isLoading = ref(false)

// Валидация формы
const isFormValid = computed(() => {
  return form.value.email && 
         form.value.password && 
         form.value.secretCode &&
         form.value.email.includes('@')
})

// Обработка входа
const handleLogin = async () => {
  if (!isFormValid.value) return

  isLoading.value = true

  try {
    const result = await authStore.login(form.value)
    
    if (result.success) {
      console.log('✅ Вход успешен, перенаправляем на:', route.query.redirect || '/dashboard')
      toast.success(`Добро пожаловать, ${result.user.email}!`)
      // Перенаправление на нужную страницу
      const redirectTo = route.query.redirect || '/dashboard'
      console.log('🔄 Пытаемся перейти на:', redirectTo)
      try {
        await router.push(redirectTo)
        console.log('✅ Перенаправление выполнено успешно')
      } catch (routerError) {
        console.error('❌ Ошибка роутера:', routerError)
        // Попробуем принудительное перенаправление
        window.location.href = redirectTo
      }
    } else {
      toast.error(result.error || 'Ошибка входа в систему')
    }
  } catch (error) {
    console.error('❌ Ошибка входа:', error)
    toast.error('Ошибка входа в систему')
  } finally {
    isLoading.value = false
  }
}

// Автозаполнение для демо
onMounted(() => {
  // Заполнение демо-данных для тестирования
  if (import.meta.env.DEV) {
    form.value.email = 'admin@webstream.local'
    form.value.password = 'password'
    form.value.secretCode = 'ADMIN123'
  }
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  padding: 1rem;
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.login-form {
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

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
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

.login-footer {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.login-footer p {
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
  .login-card {
    padding: 1.5rem;
  }
  
  .login-header h1 {
    font-size: 1.75rem;
  }
}
</style>
