<template>
  <div class="sidebar" :class="{ 
    'sidebar-open': isMobileMenuOpen
  }">
    <!-- Навигационное меню -->
    <nav class="sidebar-nav">
      <ul class="nav-list">
        <li class="nav-item">
          <router-link 
            to="/dashboard" 
            class="nav-link"
            :class="{ 'nav-link-active': $route.path === '/dashboard' }"
            @click="closeMobileMenu"
          >
            <span class="nav-icon">🏠</span>
            <span class="nav-text">Главная страница</span>
          </router-link>
        </li>

        <!-- Операторские функции -->
        <li v-if="authStore.user?.role === 'operator' || authStore.user?.role === 'admin'" class="nav-item">
          <router-link 
            to="/operator" 
            class="nav-link"
            :class="{ 'nav-link-active': $route.path === '/operator' }"
            @click="closeMobileMenu"
          >
            <span class="nav-icon">🎥</span>
            <span class="nav-text">Новая трансляция</span>
          </router-link>
        </li>

        <!-- Админские функции -->
        <li v-if="authStore.user?.role === 'admin'" class="nav-item">
          <router-link 
            to="/admin" 
            class="nav-link"
            :class="{ 'nav-link-active': $route.path === '/admin' }"
            @click="closeMobileMenu"
          >
            <span class="nav-icon">⚙️</span>
            <span class="nav-text">Админка</span>
          </router-link>
        </li>
      </ul>
    </nav>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useMobileMenu } from '@/composables/useMobileMenu'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile, isMobileMenuOpen, closeMobileMenu } = useMobileMenu()
// Локальная совместимость: ранее использовался isCollapsed
const isCollapsed = ref(true)

// Методы


// Слушаем изменения состояния мобильного меню
watch(isMobileMenuOpen, (newValue) => {
  console.log('Sidebar: Mobile menu state changed:', newValue, 'isMobile:', isMobile.value)
})

// Слушаем изменения роута для закрытия мобильного меню
watch(() => router.currentRoute.value.path, () => {
  if (isMobile.value) {
    closeMobileMenu()
  }
})

// Инициализация
onMounted(() => {
  // Восстанавливаем состояние меню из localStorage только для десктопа
  if (!isMobile.value) {
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState !== null) {
      isCollapsed.value = savedState === 'true'
    }
  } else {
    // На мобильных всегда свернуто
    isCollapsed.value = true
  }
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 60px;
  left: 0;
  width: 280px;
  height: calc(100vh - 60px);
  background: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  transform: translateX(-100%);
  z-index: 1000;
}




.sidebar-nav {
  flex: 1;
  padding: 2rem 0 1rem;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  margin-bottom: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: white;
  text-decoration: none;
  transition: all 0.2s ease;
  border-radius: 0;
  position: relative;
}

.nav-link:hover {
  background: #2a2a2a;
}

.nav-link-active {
  background: #2a2a2a;
  border-right: 3px solid #ff0000;
}

.nav-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #ff0000;
}

.nav-icon {
  font-size: 1.25rem;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.nav-text {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}


/* Стили для всех устройств */
.sidebar {
  transform: translateX(-100%);
}

.sidebar.sidebar-open {
  transform: translateX(0);
}

</style>
