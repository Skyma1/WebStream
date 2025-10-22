<template>
  <div id="app" class="app">
    <!-- Загрузочный экран -->
    <div v-if="isLoading" class="loading-screen">
      <div class="loading-spinner"></div>
      <p>Загрузка WebStream...</p>
    </div>

    <!-- Основное приложение -->
    <div v-else class="app-content">
      <!-- Показываем layout только для авторизованных пользователей -->
      <AppLayout v-if="authStore.isAuthenticated" />
      <router-view v-else />
    </div>

    <!-- Глобальные уведомления -->
    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import Toast from 'vue-toastification'
import AppLayout from '@/components/AppLayout.vue'

const authStore = useAuthStore()
const isLoading = ref(true)

onMounted(async () => {
  try {
    // Инициализация приложения
    await authStore.initialize()
  } catch (error) {
    console.error('❌ Ошибка инициализации приложения:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #0f0f0f;
  color: white;
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0f0f0f;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-screen p {
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.app-content {
  min-height: 100vh;
}
</style>

