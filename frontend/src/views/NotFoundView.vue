<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <div class="not-found-content">
        <div class="error-code">404</div>
        <h1>Страница не найдена</h1>
        <p>Запрашиваемая страница не существует или была перемещена.</p>
        <div class="actions">
          <button @click="goHome" class="btn btn-primary">
            <span class="btn-icon">🏠</span>
            На главную
          </button>
          <button @click="goBack" class="btn btn-secondary">
            <span class="btn-icon">←</span>
            Назад
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}

const goBack = () => {
  router.go(-1)
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  color: white;
  padding: 1rem;
}

.not-found-container {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.not-found-content {
  background: rgba(30, 58, 138, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 3rem 2rem;
  backdrop-filter: blur(10px);
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 1rem;
  line-height: 1;
}

.not-found-content h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: white;
}

.not-found-content p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
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

.btn-secondary {
  background: rgba(30, 41, 59, 0.5);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(30, 41, 59, 0.7);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 1rem;
}

@media (max-width: 480px) {
  .not-found-content {
    padding: 2rem 1.5rem;
  }
  
  .error-code {
    font-size: 4rem;
  }
  
  .not-found-content h1 {
    font-size: 1.5rem;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

