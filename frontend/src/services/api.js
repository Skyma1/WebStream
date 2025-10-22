/**
 * Сервис для работы с API
 */

import axios from 'axios'

// Создание экземпляра axios
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
console.log('🔍 API Base URL:', baseURL)

const api = axios.create({
  baseURL: baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Интерцептор запросов
api.interceptors.request.use(
  (config) => {
    // Получение токена из localStorage
    const token = localStorage.getItem('auth_token')
    
    // Добавление токена авторизации
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Логирование запросов в режиме разработки
    if (import.meta.env.DEV) {
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data
      })
    }
    
    return config
  },
  (error) => {
    console.error('❌ Ошибка конфигурации запроса:', error)
    return Promise.reject(error)
  }
)

// Интерцептор ответов
api.interceptors.response.use(
  (response) => {
    // Логирование ответов в режиме разработки
    if (import.meta.env.DEV) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data
      })
    }
    
    return response
  },
  async (error) => {
    // Получение токена из localStorage
    const token = localStorage.getItem('auth_token')
    
    // Логирование ошибок
    console.error('❌ API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data
    })
    
    // Обработка ошибки 401 (неавторизован)
    if (error.response?.status === 401) {
      // Очистка токена из localStorage
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      
      // Перенаправление на страницу входа
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    
    // Обработка ошибки 403 (недостаточно прав)
    if (error.response?.status === 403) {
      console.warn('⚠️ Недостаточно прав доступа')
    }
    
    // Обработка ошибки 429 (превышен лимит запросов)
    if (error.response?.status === 429) {
      console.warn('⚠️ Превышен лимит запросов')
    }
    
    // Обработка сетевых ошибок
    if (!error.response) {
      console.error('❌ Сетевая ошибка:', error.message)
    }
    
    return Promise.reject(error)
  }
)

// Методы для работы с API
const apiService = {
  // GET запрос
  get: (url, config = {}) => api.get(url, config),
  
  // POST запрос
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  
  // PUT запрос
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  
  // PATCH запрос
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),
  
  // DELETE запрос
  delete: (url, config = {}) => api.delete(url, config),
  
  // Загрузка файла
  upload: (url, formData, onProgress = null) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    })
  },
  
  // Скачивание файла
  download: (url, filename = null) => {
    return api.get(url, {
      responseType: 'blob'
    }).then(response => {
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    })
  }
}

export default apiService
