/**
 * Роутер для WebStream
 */

import { createRouter, createWebHistory } from 'vue-router'

// Импорт компонентов страниц
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import DashboardView from '@/views/DashboardView.vue'
import AdminView from '@/views/AdminView.vue'
import StreamView from '@/views/StreamView.vue'
import OperatorView from '@/views/OperatorView.vue'
import FollowingView from '@/views/FollowingView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import MultiScreenView from '@/views/MultiScreenView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    redirect: '/dashboard'
  },
  {
    path: '/multiscreen',
    name: 'multiscreen',
    component: MultiScreenView,
    meta: {
      title: 'Мультискрин',
      requiresAuth: true
    }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      title: 'Вход в систему',
      requiresAuth: false,
      hideForAuth: true // Скрыть для авторизованных пользователей
    }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: {
      title: 'Регистрация',
      requiresAuth: false,
      hideForAuth: true
    }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: {
      title: 'Главная',
      requiresAuth: true
    }
  },
  {
    path: '/streams',
    name: 'streams',
    component: DashboardView,
    meta: {
      title: 'Навигация',
      requiresAuth: true
    }
  },
  {
    path: '/following',
    name: 'following',
    component: FollowingView,
    meta: {
      title: 'Отслеживаемое',
      requiresAuth: true
    }
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: {
      title: 'Панель администратора',
      requiresAuth: true,
      requiresRole: ['admin']
    }
  },
  {
    path: '/stream/:id',
    name: 'stream',
    component: StreamView,
    meta: {
      title: 'Просмотр трансляции',
      requiresAuth: true
    },
    props: true
  },
  {
    path: '/operator',
    name: 'operator',
    component: OperatorView,
    meta: {
      title: 'Панель оператора',
      requiresAuth: true,
      requiresRole: ['operator', 'admin']
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: {
      title: 'Профиль',
      requiresAuth: true
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      title: 'Настройки',
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: {
      title: 'Страница не найдена'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Глобальные навигационные хуки
router.beforeEach(async (to, from, next) => {
  // Проверка аутентификации через localStorage
  const token = localStorage.getItem('auth_token')
  const userData = localStorage.getItem('user_data')
  
  console.log('🔄 Навигация:', from.path, '->', to.path)
  console.log('🔑 Токен:', !!token, 'Данные пользователя:', !!userData)
  
  // Установка заголовка страницы
  if (to.meta.title) {
    document.title = `${to.meta.title} - WebStream`
  }

  // Проверка аутентификации
  if (to.meta.requiresAuth) {
    if (!token || !userData) {
      // Перенаправление на страницу входа
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      })
      return
    }

    // Проверка роли
    if (to.meta.requiresRole) {
      const userRole = userData ? JSON.parse(userData).role : null
      if (!to.meta.requiresRole.includes(userRole)) {
        // Недостаточно прав - перенаправление на главную
        next({ name: 'dashboard' })
        return
      }
    }
  }

  // Скрытие страниц для авторизованных пользователей
  if (to.meta.hideForAuth && token && userData) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

// Обработка ошибок навигации
router.onError((error) => {
  console.error('❌ Ошибка роутера:', error)
})

export default router
