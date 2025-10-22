<template>
  <div class="settings-page">
    <div class="container">
      <h1>Настройки</h1>
      <div class="settings-content">
        <p>Здесь будут настройки приложения</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()

onMounted(() => {
  // Загрузка настроек
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;
}

h1 {
  color: white;
  text-align: center;
  margin-bottom: 2rem;
}

.settings-content {
  background: white;
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

p {
  color: #666;
  text-align: center;
}
</style>

