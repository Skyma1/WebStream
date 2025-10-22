/**
 * Главный файл приложения WebStream
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

import App from './App.vue'
import router from './router'
import './assets/css/main.css'

// Создание приложения
const app = createApp(App)

// Настройка Pinia для управления состоянием
const pinia = createPinia()
app.use(pinia)

// Настройка роутера
app.use(router)

// Настройка уведомлений
app.use(Toast, {
  position: 'top-right',
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  transition: 'Vue-Toastification__bounce',
  maxToasts: 5,
  newestOnTop: true
})

// Глобальная обработка ошибок
app.config.errorHandler = (err, vm, info) => {
  console.error('❌ Глобальная ошибка Vue:', err, info)
  
  // Показ уведомления об ошибке
  if (vm && vm.$toast) {
    vm.$toast.error('Произошла ошибка приложения')
  }
}

// Глобальные свойства
app.config.globalProperties.$log = console.log

// Запуск приложения
app.mount('#app')

console.log('🔧 ВЕРСИЯ 11.0 - РЕАЛИСТИЧНЫЕ ЗАГЛУШКИ WEBSOCKET - ПОРТ 8080!')
