<template>
  <div class="app-layout">
    <!-- Верхняя панель -->
    <Header />
    
    <!-- Боковое меню -->
    <Sidebar />
    
    <!-- Мобильный оверлей -->
    <div 
      v-if="isMobile && isMobileMenuOpen" 
      @click="closeMobileMenu"
      class="mobile-overlay"
    ></div>
    
    <!-- Основной контент -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'
import { useMobileMenu } from '@/composables/useMobileMenu'

const { isMobile, isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu()
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #0f0f0f;
  position: relative;
}

.main-content {
  flex: 1;
  margin-top: 60px;
  min-height: calc(100vh - 60px);
  background: #0f0f0f;
}


/* Мобильный оверлей */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  backdrop-filter: blur(2px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .main-content {
    margin-top: 60px;
    padding-top: 1rem;
  }
}

/* Дополнительные стили для очень маленьких экранов */
@media (max-width: 480px) {
  .main-content {
    margin-top: 60px;
    padding-top: 1rem;
  }
}
</style>
