/**
 * Store для управления трансляциями
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import apiService from '@/services/api'
import socketService from '@/services/socket'

export const useStreamStore = defineStore('stream', () => {
  // Состояние
  const streams = ref([])
  const currentStream = ref(null)
  const chatMessages = ref([])
  const streamUsers = ref([])
  const isLoading = ref(false)
  const isStreaming = ref(false)
  const viewerCount = ref(0)

  // Геттеры
  const activeStreams = computed(() => 
    streams.value // API уже возвращает только активные трансляции
  )

  const currentStreamMessages = computed(() => 
    chatMessages.value.filter(message => 
      !currentStream.value || message.stream_id === currentStream.value.id
    )
  )

  const onlineUsers = computed(() => 
    streamUsers.value.filter(user => user.isOnline)
  )

  // Действия для работы с трансляциями
  const fetchStreams = async () => {
    try {
      isLoading.value = true
      const response = await apiService.get('/streams')
      streams.value = response.data
      return response.data
    } catch (error) {
      console.error('❌ Ошибка получения трансляций:', error)
      const toast = useToast()
      toast.error('Ошибка загрузки трансляций')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetchStream = async (streamId) => {
    try {
      isLoading.value = true
      const response = await apiService.get(`/streams/${streamId}`)
      currentStream.value = response.data
      return response.data
    } catch (error) {
      console.error('❌ Ошибка получения трансляции:', error)
      const toast = useToast()
      toast.error('Ошибка загрузки трансляции')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const createStream = async (streamData) => {
    try {
      isLoading.value = true
      const response = await apiService.post('/streams', streamData)
      
      // Добавление новой трансляции в список
      streams.value.unshift(response.data)
      
      // Сохранение активной трансляции в localStorage
      saveActiveStream(response.data)
      
      const toast = useToast()
      toast.success('Трансляция создана')
      
      return response.data
    } catch (error) {
      console.error('❌ Ошибка создания трансляции:', error)
      const toast = useToast()
      const errorMessage = error.response?.data?.error || 'Ошибка создания трансляции'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const endStream = async (streamId) => {
    try {
      isLoading.value = true
      await apiService.patch(`/streams/${streamId}/end`)
      
      // Обновление статуса трансляции
      const streamIndex = streams.value.findIndex(s => s.id === streamId)
      if (streamIndex !== -1) {
        streams.value[streamIndex].is_active = false
        streams.value[streamIndex].ended_at = new Date().toISOString()
      }
      
      if (currentStream.value && currentStream.value.id === streamId) {
        currentStream.value.is_active = false
        currentStream.value.ended_at = new Date().toISOString()
        // Очищаем localStorage при завершении трансляции
        clearActiveStream()
      }
      
      const toast = useToast()
      toast.success('Трансляция завершена')
      
      return true
    } catch (error) {
      console.error('❌ Ошибка завершения трансляции:', error)
      const toast = useToast()
      const errorMessage = error.response?.data?.error || 'Ошибка завершения трансляции'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Действия для работы с чатом
  const fetchChatMessages = async (streamId, limit = 50) => {
    try {
      const response = await apiService.get(`/streams/${streamId}/chat`, {
        params: { limit }
      })
      return response.data
    } catch (error) {
      console.error('❌ Ошибка получения сообщений чата:', error)
      throw error
    }
  }

  const setChatHistory = (messages) => {
    chatMessages.value = messages
  }

  const addChatMessage = (message) => {
    console.log('💬 Получено новое сообщение чата:', message)
    chatMessages.value.push(message)
    
    // Ограничение количества сообщений в памяти
    if (chatMessages.value.length > 1000) {
      chatMessages.value = chatMessages.value.slice(-500)
    }
    
    console.log('📝 Всего сообщений в чате:', chatMessages.value.length)
  }

  const sendChatMessage = (streamId, message) => {
    if (!message || message.trim().length === 0) {
      const toast = useToast()
      toast.error('Сообщение не может быть пустым')
      return
    }

    console.log('📤 Отправка сообщения в трансляцию', streamId, ':', message)
    socketService.sendChatMessage(streamId, message)
  }

  const sendSystemMessage = (streamId, message) => {
    socketService.sendSystemMessage(streamId, message)
  }

  // Действия для работы с пользователями
  const addUserToStream = (user) => {
    const existingUserIndex = streamUsers.value.findIndex(u => u.id === user.id)
    if (existingUserIndex !== -1) {
      streamUsers.value[existingUserIndex] = { ...user, isOnline: true }
    } else {
      streamUsers.value.push({ ...user, isOnline: true })
    }
  }

  const removeUserFromStream = (userId) => {
    const userIndex = streamUsers.value.findIndex(u => u.id === userId)
    if (userIndex !== -1) {
      streamUsers.value[userIndex].isOnline = false
    }
  }

  const clearStreamUsers = () => {
    streamUsers.value = []
  }

  // Действия для WebRTC
  const startStreaming = () => {
    isStreaming.value = true
  }

  const stopStreaming = () => {
    isStreaming.value = false
  }

  const updateViewerCount = (count) => {
    viewerCount.value = count
  }

  // Действия для присоединения к трансляции
  const joinStream = (streamId) => {
    console.log('🔍 joinStream вызван для streamId:', streamId)
    console.log('🔍 currentStream.value:', currentStream.value)
    
    if (currentStream.value && currentStream.value.id === streamId) {
      console.log('Уже подключен к этой трансляции, но принудительно присоединяемся к WebSocket комнате')
      // Принудительно присоединяемся к WebSocket комнате
      socketService.joinStream(streamId)
      return
    }

    // Покидание предыдущей трансляции
    if (currentStream.value) {
      leaveStream(currentStream.value.id)
    }

    // Присоединение к новой трансляции
    socketService.joinStream(streamId)
    
    // Загрузка информации о трансляции
    fetchStream(streamId)
  }

  const leaveStream = (streamId) => {
    socketService.leaveStream(streamId)
    
    if (currentStream.value && currentStream.value.id === streamId) {
      currentStream.value = null
      chatMessages.value = []
      clearStreamUsers()
    }
  }

  // Очистка текущей трансляции
  const clearCurrentStream = () => {
    currentStream.value = null
    chatMessages.value = []
    clearStreamUsers()
  }

  // Очистка состояния
  const clearState = () => {
    streams.value = []
    currentStream.value = null
    chatMessages.value = []
    streamUsers.value = []
    isStreaming.value = false
    viewerCount.value = 0
  }

  // Функции для работы с localStorage
  const saveActiveStream = (stream) => {
    try {
      localStorage.setItem('activeStream', JSON.stringify(stream))
      console.log('💾 Сохранена активная трансляция:', stream.id)
    } catch (error) {
      console.error('❌ Ошибка сохранения трансляции в localStorage:', error)
    }
  }

  const getActiveStream = () => {
    try {
      const saved = localStorage.getItem('activeStream')
      if (saved) {
        const stream = JSON.parse(saved)
        console.log('📂 Восстановлена трансляция из localStorage:', stream.id)
        return stream
      }
    } catch (error) {
      console.error('❌ Ошибка чтения трансляции из localStorage:', error)
    }
    return null
  }

  const clearActiveStream = () => {
    try {
      localStorage.removeItem('activeStream')
      console.log('🗑️ Очищена активная трансляция из localStorage')
    } catch (error) {
      console.error('❌ Ошибка очистки трансляции из localStorage:', error)
    }
  }

  const restoreStreamState = async () => {
    const savedStream = getActiveStream()
    if (savedStream) {
      try {
        // Проверяем, что трансляция все еще активна
        const response = await apiService.get(`/streams/${savedStream.id}`)
        if (response.data && response.data.is_active) {
          currentStream.value = response.data
          console.log('✅ Восстановлена активная трансляция:', response.data.id)
          return response.data
        } else {
          // Трансляция больше не активна, очищаем localStorage
          clearActiveStream()
          console.log('⚠️ Трансляция больше не активна, очищен localStorage')
        }
      } catch (error) {
        console.error('❌ Ошибка проверки трансляции:', error)
        clearActiveStream()
      }
    }
    return null
  }

  return {
    // Состояние
    streams,
    currentStream,
    chatMessages,
    streamUsers,
    isLoading,
    isStreaming,
    viewerCount,
    
    // Геттеры
    activeStreams,
    currentStreamMessages,
    onlineUsers,
    
    // Действия для трансляций
    fetchStreams,
    fetchStream,
    createStream,
    endStream,
    
    // Действия для localStorage
    saveActiveStream,
    getActiveStream,
    clearActiveStream,
    restoreStreamState,
    
    // Действия для чата
    fetchChatMessages,
    setChatHistory,
    addChatMessage,
    sendChatMessage,
    sendSystemMessage,
    
    // Действия для пользователей
    addUserToStream,
    removeUserFromStream,
    clearStreamUsers,
    
    // Действия для WebRTC
    startStreaming,
    stopStreaming,
    updateViewerCount,
    
    // Действия для присоединения
    joinStream,
    leaveStream,
    
    // Очистка
    clearCurrentStream,
    clearState
  }
})

