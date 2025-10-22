import { ref, onMounted, onUnmounted } from 'vue'

// Глобальное состояние для всех компонентов
const isMobile = ref(false)
const isMobileMenuOpen = ref(false)

// Инициализация при первом запуске
if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth <= 768
  isMobileMenuOpen.value = !isMobile.value // На ПК открыт, на мобильных закрыт
}

// Проверка размера экрана
const checkScreenSize = () => {
  const wasMobile = isMobile.value
  isMobile.value = window.innerWidth <= 768
  
  // Если переключились с мобильного на ПК или наоборот
  if (wasMobile !== isMobile.value) {
    if (!isMobile.value) {
      isMobileMenuOpen.value = true // На ПК сайдбар открыт по умолчанию
    } else {
      isMobileMenuOpen.value = false // На мобильных закрыт по умолчанию
    }
  }
}

// Управление мобильным меню
const toggleMobileMenu = () => {
  console.log('toggleMobileMenu called, current state:', isMobileMenuOpen.value)
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  console.log('toggleMobileMenu new state:', isMobileMenuOpen.value)
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Инициализация только один раз
let isInitialized = false

export function useMobileMenu() {
  // Инициализируем только один раз
  if (!isInitialized) {
    onMounted(() => {
      checkScreenSize()
      window.addEventListener('resize', checkScreenSize)
    })
    isInitialized = true
  }

  return {
    isMobile,
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
    checkScreenSize
  }
}
