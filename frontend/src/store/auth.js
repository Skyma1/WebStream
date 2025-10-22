/**
 * Store для управления аутентификацией
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import socketService from '@/services/socket'

export const useAuthStore = defineStore('auth', () => {
  // Состояние
  const user = ref(null)
  const token = ref(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // Геттеры
  const isAuthenticated = computed(() => !!user.value && !!token.value)
  const userRole = computed(() => user.value?.role)
  const isAdmin = computed(() => userRole.value === 'admin')
  const isOperator = computed(() => userRole.value === 'operator')
  const isViewer = computed(() => userRole.value === 'viewer')

  // Действия
  const setUser = (userData) => {
    user.value = userData
    if (userData) {
      localStorage.setItem('user_data', JSON.stringify(userData))
      console.log('✅ Пользователь сохранен в localStorage:', userData.email)
    } else {
      localStorage.removeItem('user_data')
      console.log('✅ Пользователь удален из localStorage')
    }
  }

  const setToken = (tokenValue) => {
    token.value = tokenValue
    if (tokenValue) {
      localStorage.setItem('auth_token', tokenValue)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  const login = async (credentials) => {
    try {
      isLoading.value = true
      
      const response = await apiService.post('/auth/login', credentials)
      
      if (response.data.success) {
        setToken(response.data.token)
        setUser(response.data.user)
        
        // Подключение к WebSocket
        await socketService.connect(response.data.token)
        
        // Уведомление будет показано в компоненте
        console.log(`✅ Вход успешен: ${response.data.user.email}`)
        
        return { success: true, user: response.data.user }
      }
    } catch (error) {
      console.error('❌ Ошибка входа:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка входа в систему'
      console.error('❌ Ошибка входа:', errorMessage)
      
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  const register = async (userData) => {
    try {
      isLoading.value = true
      
      const response = await apiService.post('/auth/register', userData)
      
      if (response.data.success) {
        setToken(response.data.token)
        setUser(response.data.user)
        
        // Подключение к WebSocket
        await socketService.connect(response.data.token)
        
        // Уведомление будет показано в компоненте
        console.log(`✅ Регистрация успешна: ${response.data.user.email}`)
        
        return { success: true, user: response.data.user }
      }
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка регистрации'
      console.error('❌ Ошибка регистрации:', errorMessage)
      
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    try {
      // Отключение от WebSocket
      socketService.disconnect()
      
      // Выход через API
      if (token.value) {
        await apiService.post('/auth/logout')
      }
    } catch (error) {
      console.error('❌ Ошибка выхода:', error)
    } finally {
      // Очистка состояния
      setUser(null)
      setToken(null)
      
      console.log('✅ Вы вышли из системы')
    }
  }

  const refreshToken = async () => {
    try {
      if (!token.value) return false
      
      const response = await apiService.post('/auth/refresh')
      
      if (response.data.success) {
        setToken(response.data.token)
        return true
      }
    } catch (error) {
      console.error('❌ Ошибка обновления токена:', error)
      await logout()
      return false
    }
  }

  const fetchUserProfile = async () => {
    try {
      if (!token.value) return false
      
      const response = await apiService.get('/auth/me')
      setUser(response.data)
      return true
    } catch (error) {
      console.error('❌ Ошибка получения профиля:', error)
      
      // Если токен недействителен, выходим из системы
      if (error.response?.status === 401) {
        await logout()
      }
      return false
    }
  }

  const initialize = async () => {
    if (isInitialized.value) return
    
    try {
      isLoading.value = true
      
      if (token.value) {
        // Попытка получить профиль пользователя с таймаутом
        const profileLoaded = await Promise.race([
          fetchUserProfile(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          )
        ])
        
        if (profileLoaded) {
          // Подключение к WebSocket с таймаутом
          try {
            await Promise.race([
              socketService.connect(token.value),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000) // Увеличиваем до 10 секунд
              )
            ])
          } catch (wsError) {
            console.warn('⚠️ WebSocket подключение не удалось, продолжаем без него:', wsError.message)
            // Не очищаем токен при ошибке WebSocket, только при ошибке аутентификации
          }
        }
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error)
      // Очищаем недействительный токен только при ошибках аутентификации
      if (error.message.includes('401') || error.response?.status === 401) {
        setToken(null)
        setUser(null)
      }
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }
  }

  const updateProfile = async (profileData) => {
    try {
      isLoading.value = true
      
      const response = await apiService.put('/users/profile', profileData)
      setUser(response.data)
      
      console.log('✅ Профиль обновлен')
      
      return { success: true, user: response.data }
    } catch (error) {
      console.error('❌ Ошибка обновления профиля:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка обновления профиля'
      console.error('❌', errorMessage)
      
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (passwordData) => {
    try {
      isLoading.value = true
      
      await apiService.post('/users/change-password', passwordData)
      
      console.log('✅ Пароль изменен')
      
      return { success: true }
    } catch (error) {
      console.error('❌ Ошибка изменения пароля:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка изменения пароля'
      console.error('❌', errorMessage)
      
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  const getActiveSessions = async () => {
    try {
      const response = await apiService.get('/users/sessions')
      return response.data
    } catch (error) {
      console.error('❌ Ошибка получения сессий:', error)
      throw error
    }
  }

  const terminateSession = async (sessionId) => {
    try {
      await apiService.delete(`/users/sessions/${sessionId}`)
      
      console.log('✅ Сессия завершена')
      
      return { success: true }
    } catch (error) {
      console.error('❌ Ошибка завершения сессии:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка завершения сессии'
      console.error('❌', errorMessage)
      
      return { success: false, error: errorMessage }
    }
  }

  const terminateAllSessions = async () => {
    try {
      await apiService.delete('/users/sessions/all')
      
      console.log('✅ Все сессии завершены')
      
      return { success: true }
    } catch (error) {
      console.error('❌ Ошибка завершения всех сессий:', error)
      
      const errorMessage = error.response?.data?.error || 'Ошибка завершения сессий'
      console.error('❌', errorMessage)
      
      return { success: false, error: errorMessage }
    }
  }

  const updateUserProfile = (profileData) => {
    if (user.value) {
      user.value = { ...user.value, ...profileData }
      localStorage.setItem('user_data', JSON.stringify(user.value))
      console.log('✅ Профиль пользователя обновлен в store')
    }
  }

  return {
    // Состояние
    user,
    token,
    isLoading,
    isInitialized,
    
    // Геттеры
    isAuthenticated,
    userRole,
    isAdmin,
    isOperator,
    isViewer,
    
    // Действия
    setUser,
    setToken,
    login,
    register,
    logout,
    refreshToken,
    fetchUserProfile,
    initialize,
    updateProfile,
    changePassword,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
    updateUserProfile
  }
})
