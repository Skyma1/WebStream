<template>
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <!-- Кнопка сайдбара -->
        <button 
          @click="toggleSidebar" 
          class="sidebar-toggle-btn"
          :class="{ 'menu-open': isMobileMenuOpen }"
        >
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
        
        <!-- Логотип -->
        <div class="header-logo">
          <span class="logo-text">WebStream</span>
        </div>
      </div>
      <!-- Поиск (скрыт) -->
      <!-- <div class="header-search">
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Поиск" 
            class="search-input"
            v-model="searchQuery"
            @keyup.enter="handleSearch"
          />
        </div>
      </div> -->

      <!-- Правая часть -->
      <div class="header-right">
        <!-- Кнопка профиля/настроек -->
        <button class="profile-btn" @click="toggleProfileMenu">
          <div class="profile-avatar">
            <span class="avatar-text">{{ userInitials }}</span>
          </div>
        </button>

        <!-- Выпадающее меню профиля -->
        <div v-if="showProfileMenu" class="profile-menu">
          <div class="profile-info">
            <div class="profile-avatar-large">
              <span class="avatar-text">{{ userInitials }}</span>
            </div>
            <div class="profile-details">
              <div class="profile-name">{{ authStore.user?.username || authStore.user?.email || 'Пользователь' }}</div>
              <div class="profile-role">{{ userRoleText }}</div>
            </div>
          </div>
          
          <!-- <div class="profile-menu-items">
            <router-link to="/profile" class="profile-menu-item" @click="closeProfileMenu">
              <span class="menu-icon">👤</span>
              <span>Профиль</span>
            </router-link>
            
            <router-link to="/settings" class="profile-menu-item" @click="closeProfileMenu">
              <span class="menu-icon">⚙️</span>
              <span>Настройки</span>
            </router-link>
             -->
            <div class="profile-menu-divider"></div>
            
            <button class="profile-menu-item logout-item" @click="handleLogout">
              <span class="menu-icon">🚪</span>
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useMobileMenu } from '@/composables/useMobileMenu'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile, isMobileMenuOpen, toggleMobileMenu } = useMobileMenu()

// Состояние
const searchQuery = ref('')
const showProfileMenu = ref(false)

// Вычисляемые свойства
const userInitials = computed(() => {
  const name = authStore.user?.username || authStore.user?.email || ''
  const words = name.split(' ')
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
})

const userRoleText = computed(() => {
  const role = authStore.user?.role
  switch (role) {
    case 'admin': return 'Администратор'
    case 'operator': return 'Оператор'
    case 'viewer': return 'Зритель'
    default: return 'Пользователь'
  }
})

// Методы
const toggleSidebar = () => {
  console.log('Toggle sidebar clicked, isMobile:', isMobile.value, 'isMobileMenuOpen:', isMobileMenuOpen.value)
  toggleMobileMenu() // Используем одно состояние для всех устройств
}

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    // Здесь можно добавить логику поиска
    console.log('Поиск:', searchQuery.value)
  }
}

const toggleProfileMenu = () => {
  showProfileMenu.value = !showProfileMenu.value
}

const closeProfileMenu = () => {
  showProfileMenu.value = false
}

const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Ошибка выхода:', error)
  }
}

// Закрытие меню при клике вне его
const handleClickOutside = (event) => {
  if (!event.target.closest('.header-right')) {
    showProfileMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  z-index: 1000;
  display: flex;
  align-items: center;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0;
  max-width: none;
  margin: 0;
}

.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  margin-left: 12px;
}

/* Кнопка сайдбара */
.sidebar-toggle-btn {
  display: flex;
  background: none;
  border: none;
  width: 24px;
  height: 24px;
  cursor: pointer;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: all 0.2s ease;
  margin-right: 12px;
  padding: 0;
}

.sidebar-toggle-btn:hover {
  opacity: 0.7;
}

.hamburger-line {
  width: 18px;
  height: 2px;
  background: white;
  transition: all 0.2s ease;
  border-radius: 1px;
}

.sidebar-toggle-btn.menu-open .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.sidebar-toggle-btn.menu-open .hamburger-line:nth-child(2) {
  opacity: 0;
}

.sidebar-toggle-btn.menu-open .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

/* Логотип */
.header-logo {
  flex-shrink: 0;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ff0000;
  white-space: nowrap;
}


/* Поиск */
.header-search {
  opacity: 0;
  flex: 1;
  max-width: 400px;
  margin: 0 2rem;
}

.search-container {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 40px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 0 0.75rem 0 2.5rem;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #ff0000;
  box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.1);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

/* Правая часть */
.header-right {
  position: relative;
  flex-shrink: 0;
}

.profile-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.profile-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.profile-avatar {
  width: 32px;
  height: 32px;
  background: #ff0000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

/* Выпадающее меню профиля */
.profile-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 280px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 1001;
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.profile-avatar-large {
  width: 40px;
  height: 40px;
  background: #ff0000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-details {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-menu-items {
  padding: 0.5rem 0;
}

.profile-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: white;
  text-decoration: none;
  transition: all 0.2s ease;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
}

.profile-menu-item:hover {
  background: #2a2a2a;
}

.profile-menu-item.logout-item {
  color: #ff6b6b;
}

.profile-menu-item.logout-item:hover {
  background: rgba(255, 107, 107, 0.1);
}

.menu-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.profile-menu-divider {
  height: 1px;
  background: #2a2a2a;
  margin: 0.5rem 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .header-content {
    padding: 0;
  }
  
  .header-search {
    margin: 0 1rem;
    max-width: 200px;
  }
  
  .logo-text {
    font-size: 1.25rem;
  }
  
  .profile-menu {
    width: 240px;
  }
}

@media (max-width: 480px) {
  .header-search {
    display: none;
  }
  
  .header-content {
    padding: 0 0.5rem;
  }
}
</style>
