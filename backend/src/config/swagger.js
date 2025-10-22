/**
 * Конфигурация Swagger для API документации
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WebStream API',
            version: '1.0.0',
            description: `
                API для закрытого сайта трансляций WebStream.
                
                ## Описание
                
                WebStream - это закрытая платформа для проведения трансляций с ограниченным количеством участников.
                
                ## Возможности
                
                - **Аутентификация**: Регистрация по секретным кодам, вход в систему
                - **Роли пользователей**: 
                  - Зрители (до 25 человек)
                  - Операторы (до 4 человек) 
                  - Администраторы
                - **Трансляции**: Создание и управление трансляциями в реальном времени
                - **Чат**: Общение зрителей и операторов во время трансляций
                - **WebRTC**: Видео и аудио трансляции с низкой задержкой
                
                ## Безопасность
                
                - JWT токены для аутентификации
                - Хеширование паролей с bcrypt
                - Защита от CSRF и других атак
                - Rate limiting для предотвращения злоупотреблений
                
                ## Лимиты
                
                - Максимум 4 активных оператора
                - Максимум 25 зрителей на трансляцию
                - Ограничения на размер сообщений и файлов
            `,
            contact: {
                name: 'WebStream Team',
                email: 'admin@webstream.local'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:3000',
                description: 'Основной сервер API'
            },
            {
                url: 'https://api.webstream.local',
                description: 'Продакшн сервер (если настроен)'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT токен для аутентификации. Получите токен через /api/auth/login или /api/auth/register'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Уникальный идентификатор пользователя'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email адрес пользователя'
                        },
                        role: {
                            type: 'string',
                            enum: ['viewer', 'operator', 'admin'],
                            description: 'Роль пользователя в системе'
                        },
                        is_active: {
                            type: 'boolean',
                            description: 'Активен ли пользователь'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Дата создания аккаунта'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Дата последнего обновления'
                        }
                    }
                },
                SecretCode: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Уникальный идентификатор кода'
                        },
                        code: {
                            type: 'string',
                            description: 'Секретный код для регистрации'
                        },
                        role: {
                            type: 'string',
                            enum: ['viewer', 'operator', 'admin'],
                            description: 'Роль, которая будет присвоена пользователю при регистрации'
                        },
                        prefix: {
                            type: 'string',
                            description: 'Префикс кода (опционально)'
                        },
                        is_used: {
                            type: 'boolean',
                            description: 'Использован ли код'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Дата создания кода'
                        },
                        used_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Дата использования кода'
                        },
                        used_by_email: {
                            type: 'string',
                            description: 'Email пользователя, который использовал код'
                        }
                    }
                },
                Stream: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Уникальный идентификатор трансляции'
                        },
                        title: {
                            type: 'string',
                            description: 'Название трансляции'
                        },
                        description: {
                            type: 'string',
                            description: 'Описание трансляции'
                        },
                        is_active: {
                            type: 'boolean',
                            description: 'Активна ли трансляция'
                        },
                        started_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Время начала трансляции'
                        },
                        ended_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Время окончания трансляции'
                        },
                        viewer_count: {
                            type: 'integer',
                            description: 'Количество зрителей'
                        },
                        operator_email: {
                            type: 'string',
                            description: 'Email оператора трансляции'
                        }
                    }
                },
                ChatMessage: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Уникальный идентификатор сообщения'
                        },
                        message: {
                            type: 'string',
                            description: 'Текст сообщения'
                        },
                        message_type: {
                            type: 'string',
                            enum: ['text', 'system', 'admin'],
                            description: 'Тип сообщения'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Время отправки сообщения'
                        },
                        user_email: {
                            type: 'string',
                            description: 'Email отправителя'
                        },
                        user_role: {
                            type: 'string',
                            description: 'Роль отправителя'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Успешность операции'
                        },
                        token: {
                            type: 'string',
                            description: 'JWT токен для аутентификации'
                        },
                        user: {
                            $ref: '#/components/schemas/User'
                        }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Описание ошибки'
                        },
                        code: {
                            type: 'string',
                            description: 'Код ошибки для программной обработки'
                        },
                        details: {
                            type: 'object',
                            description: 'Дополнительные детали ошибки'
                        }
                    }
                },
                StatsResponse: {
                    type: 'object',
                    properties: {
                        totalCodes: {
                            type: 'integer',
                            description: 'Общее количество секретных кодов'
                        },
                        usedCodes: {
                            type: 'integer',
                            description: 'Количество использованных кодов'
                        },
                        operators: {
                            type: 'integer',
                            description: 'Количество операторов'
                        },
                        viewers: {
                            type: 'integer',
                            description: 'Количество зрителей'
                        },
                        activeStreams: {
                            type: 'integer',
                            description: 'Количество активных трансляций'
                        }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Ошибка аутентификации',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse'
                            },
                            example: {
                                error: 'Токен доступа не предоставлен',
                                code: 'NO_TOKEN'
                            }
                        }
                    }
                },
                ForbiddenError: {
                    description: 'Недостаточно прав доступа',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse'
                            },
                            example: {
                                error: 'Недостаточно прав доступа',
                                code: 'INSUFFICIENT_PERMISSIONS'
                            }
                        }
                    }
                },
                NotFoundError: {
                    description: 'Ресурс не найден',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse'
                            },
                            example: {
                                error: 'Ресурс не найден',
                                code: 'RESOURCE_NOT_FOUND'
                            }
                        }
                    }
                },
                ValidationError: {
                    description: 'Ошибка валидации данных',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse'
                            },
                            example: {
                                error: 'Ошибка валидации данных',
                                code: 'VALIDATION_ERROR',
                                details: [
                                    {
                                        field: 'email',
                                        message: 'Введите корректный email адрес'
                                    }
                                ]
                            }
                        }
                    }
                },
                RateLimitError: {
                    description: 'Превышен лимит запросов',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse'
                            },
                            example: {
                                error: 'Слишком много запросов с этого IP, попробуйте позже',
                                code: 'RATE_LIMIT_EXCEEDED'
                            }
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Аутентификация',
                description: 'Регистрация, вход и управление сессиями'
            },
            {
                name: 'Администрирование',
                description: 'Управление системой, пользователями и секретными кодами'
            },
            {
                name: 'Трансляции',
                description: 'Создание, управление и просмотр трансляций'
            },
            {
                name: 'Пользователи',
                description: 'Управление профилем и настройками пользователя'
            }
        ]
    },
    apis: [
        './src/routes/*.js', // Путь к файлам с маршрутами
        './src/app.js' // Главный файл приложения
    ]
};

// Генерация спецификации Swagger
const swaggerSpec = swaggerJsdoc(options);

// Настройка Swagger UI
const swaggerUiOptions = {
    customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #3b82f6; }
        .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; }
    `,
    customSiteTitle: 'WebStream API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2
    }
};

module.exports = {
    swaggerSpec,
    swaggerUi,
    swaggerUiOptions
};
