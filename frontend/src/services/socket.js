/**
 * Сервис для работы с WebSocket (Socket.IO)
 */

import { io } from 'socket.io-client'
// Убираем импорт useAuthStore для избежания ошибок вне контекста Vue
import { useStreamStore } from '@/store/stream'

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10 // Увеличиваем количество попыток
    this.reconnectDelay = 2000 // Увеличиваем задержку
    this.heartbeatInterval = null
    this.heartbeatTimeout = null
    this.heartbeatIntervalMs = 30000 // Проверка каждые 30 секунд
    this.heartbeatTimeoutMs = 10000 // Таймаут ответа 10 секунд
  }

  /**
   * Подключение к WebSocket серверу
   */
  async connect(token) {
    try {
      if (this.socket && this.isConnected) {
        return
      }

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
      
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      })

      this.setupEventHandlers()
      
      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          // Отправляем событие аутентификации
          this.socket.emit('authenticate', { token: token })
        })

        this.socket.on('authenticated', (data) => {
          if (data.success) {
            this.isConnected = true
            this.reconnectAttempts = 0
            this.startHeartbeat() // Запускаем heartbeat
            resolve()
          } else {
            console.error('❌ Ошибка аутентификации WebSocket:', data.error)
            reject(new Error(data.error || 'Ошибка аутентификации'))
          }
        })

        this.socket.on('connect_error', (error) => {
          console.error('❌ Ошибка подключения WebSocket:', error)
          reject(error)
        })

        // Таймаут подключения
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Таймаут подключения WebSocket'))
          }
        }, 10000)
      })
    } catch (error) {
      console.error('❌ Ошибка подключения WebSocket:', error)
      throw error
    }
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventHandlers() {
    if (!this.socket) return

    // Подключение
    this.socket.on('connect', () => {
      this.isConnected = true
      this.reconnectAttempts = 0
    })

    // Отключение
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false
      
      if (reason === 'io server disconnect') {
        // Сервер принудительно отключил клиента
        this.handleReconnect()
      }
    })

    // Ошибка подключения
    this.socket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error)
      this.isConnected = false
      this.handleReconnect()
    })

    // Аутентификация
    this.socket.on('authenticated', (data) => {
      if (!data.success) {
        console.error('❌ Ошибка аутентификации WebSocket:', data.error)
      }
    })

    // Уведомления
    this.socket.on('notification', (data) => {
      // Здесь можно добавить обработку уведомлений
    })

    // События чата
    this.socket.on('chat_history', (messages) => {
      const streamStore = useStreamStore()
      streamStore.setChatHistory(messages)
    })

    this.socket.on('new_chat_message', (message) => {
      const streamStore = useStreamStore()
      streamStore.addChatMessage(message)
    })

    this.socket.on('user_joined', (data) => {
      const streamStore = useStreamStore()
      streamStore.addUserToStream(data.user)
    })

    this.socket.on('user_left', (data) => {
      const streamStore = useStreamStore()
      streamStore.removeUserFromStream(data.user.id)
    })

    // Обновление счётчика зрителей
    this.socket.on('viewer_count_update', (data) => {
      const streamStore = useStreamStore()
      streamStore.updateViewerCount(data.streamId, data.viewerCount)
    })

    // WebRTC события
    this.socket.on('webrtc_offer', (data) => {
      // Обработка WebRTC offer
    })

    this.socket.on('webrtc_answer', (data) => {
      // Обработка WebRTC answer
    })

    this.socket.on('webrtc_ice_candidate', (data) => {
      // Обработка WebRTC ICE candidate
    })

    // Heartbeat ответ
    this.socket.on('pong', () => {
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout)
        this.heartbeatTimeout = null
      }
    })

    // Ошибки
    this.socket.on('error', (error) => {
      console.error('❌ Ошибка WebSocket:', {
        error: error.message || error,
        socketId: this.socket?.id,
        isConnected: this.isConnected,
        timestamp: new Date().toISOString()
      })
      // Не пытаемся переподключиться при ошибке, пусть это делает disconnect handler
    })
  }

  /**
   * Запуск heartbeat для проверки соединения
   */
  startHeartbeat() {
    this.stopHeartbeat() // Останавливаем предыдущий heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected || !this.socket) {
        this.handleReconnect()
        return
      }

      // Отправляем ping
      this.socket.emit('ping')
      
      // Устанавливаем таймаут для ответа
      this.heartbeatTimeout = setTimeout(() => {
        console.warn('⚠️ Heartbeat timeout, переподключаемся')
        this.isConnected = false
        this.handleReconnect()
      }, this.heartbeatTimeoutMs)
    }, this.heartbeatIntervalMs)
  }

  /**
   * Остановка heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  /**
   * Обработка переподключения
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Превышено максимальное количество попыток переподключения')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000) // Максимум 30 секунд
    
    console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${delay}ms`)
    
    setTimeout(() => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        this.connect(token).catch(error => {
          console.error('❌ Ошибка переподключения:', error)
        })
      }
    }, delay)
  }

  /**
   * Отключение от WebSocket
   */
  disconnect() {
    this.stopHeartbeat() // Останавливаем heartbeat
    
    if (this.socket) {
      console.log('🔌 Отключение WebSocket')
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.reconnectAttempts = 0
    }
  }

  /**
   * Присоединение к трансляции
   */
  joinStream(streamId) {
    console.log('🔍 joinStream вызван для streamId:', streamId)
    console.log('🔍 WebSocket socket:', !!this.socket)
    console.log('🔍 WebSocket isConnected:', this.isConnected)
    
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log(`📺 Присоединение к трансляции ${streamId}`)
    this.socket.emit('join_stream', { streamId })
  }

  /**
   * Покидание трансляции
   */
  leaveStream(streamId) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log(`📺 Покидание трансляции ${streamId}`)
    this.socket.emit('leave_stream', { streamId })
  }

  /**
   * Отправка сообщения в чат
   */
  sendChatMessage(streamId, message) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    if (!message || message.trim().length === 0) {
      console.error('❌ Сообщение не может быть пустым')
      return
    }

    console.log(`💬 Отправка сообщения в трансляцию ${streamId}:`, message)
    this.socket.emit('chat_message', { streamId, message: message.trim() })
  }

  /**
   * Отправка системного сообщения
   */
  sendSystemMessage(streamId, message) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log(`🔧 Отправка системного сообщения в трансляцию ${streamId}:`, message)
    this.socket.emit('system_message', { streamId, message })
  }

  /**
   * WebRTC сигналинг
   */
  // WebRTC события для MediaSoup
  notifyNewProducer(streamId, producerId, kind) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log('📡 Уведомление о новом продюсере')
    this.socket.emit('new_producer', { streamId, producerId, kind })
  }

  notifyProducerClosed(streamId, producerId) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log('📡 Уведомление о закрытии продюсера')
    this.socket.emit('producer_closed', { streamId, producerId })
  }

  notifyConsumerClosed(streamId, consumerId) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket не подключен')
      return
    }

    console.log('📡 Уведомление о закрытии консьюмера')
    this.socket.emit('consumer_closed', { streamId, consumerId })
  }

  /**
   * Получение статуса подключения
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id
    }
  }

  /**
   * Подписка на событие
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  /**
   * Отписка от события
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  /**
   * Эмиссия события
   */
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data)
    } else {
      console.error('❌ WebSocket не подключен, невозможно отправить событие:', event)
    }
  }
}

// Создание единственного экземпляра сервиса
const socketService = new SocketService()

export default socketService
