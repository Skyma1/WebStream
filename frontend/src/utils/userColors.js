// Утилита для генерации уникальных цветов пользователей

// Предопределенные цвета для пользователей
const USER_COLORS = [
  '#ff6b6b', // Красный
  '#4ecdc4', // Бирюзовый
  '#45b7d1', // Голубой
  '#96ceb4', // Мятный
  '#feca57', // Желтый
  '#ff9ff3', // Розовый
  '#54a0ff', // Синий
  '#5f27cd', // Фиолетовый
  '#00d2d3', // Циан
  '#ff9f43', // Оранжевый
  '#10ac84', // Зеленый
  '#ee5a24', // Красно-оранжевый
  '#0984e3', // Темно-синий
  '#a29bfe', // Светло-фиолетовый
  '#fd79a8', // Светло-розовый
  '#fdcb6e', // Светло-оранжевый
  '#6c5ce7', // Фиолетово-синий
  '#00b894', // Изумрудный
  '#e17055', // Коралловый
  '#81ecec', // Светло-бирюзовый
  '#74b9ff', // Светло-синий
  '#a29bfe', // Лавандовый
  '#fd79a8', // Розово-красный
  '#fdcb6e', // Золотистый
  '#6c5ce7', // Индиго
  '#00b894', // Морской зеленый
  '#e17055', // Персиковый
  '#81ecec', // Аквамарин
  '#74b9ff', // Небесно-голубой
  '#a29bfe'  // Сливовый
]

// Кэш для хранения цветов пользователей
const userColorCache = new Map()

/**
 * Получает уникальный цвет для пользователя
 * @param {string} userId - ID пользователя или email
 * @returns {string} - HEX цвет
 */
export function getUserColor(userId) {
  if (!userId) return '#ffffff' // Белый по умолчанию
  
  // Проверяем кэш
  if (userColorCache.has(userId)) {
    return userColorCache.get(userId)
  }
  
  // Генерируем цвет на основе хэша userId
  const hash = hashString(userId)
  const colorIndex = Math.abs(hash) % USER_COLORS.length
  const color = USER_COLORS[colorIndex]
  
  // Сохраняем в кэш
  userColorCache.set(userId, color)
  
  return color
}

/**
 * Простая хэш-функция для строки
 * @param {string} str - Строка для хэширования
 * @returns {number} - Хэш
 */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Конвертируем в 32-битное число
  }
  return hash
}

/**
 * Очищает кэш цветов (полезно для тестирования)
 */
export function clearUserColorCache() {
  userColorCache.clear()
}

/**
 * Получает контрастный цвет текста для фона
 * @param {string} backgroundColor - HEX цвет фона
 * @returns {string} - 'white' или 'black'
 */
export function getContrastTextColor(backgroundColor) {
  // Убираем # если есть
  const hex = backgroundColor.replace('#', '')
  
  // Конвертируем в RGB
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Вычисляем яркость
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  
  // Возвращаем контрастный цвет
  return brightness > 128 ? '#000000' : '#ffffff'
}
