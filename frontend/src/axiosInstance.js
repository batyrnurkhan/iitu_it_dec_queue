// axiosInstance.js

import axios from 'axios';
import { config } from './config';

// Создаем экземпляр axios с базовой конфигурацией
const axiosInstance = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: config.timeout || 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptор для запросов - добавляем токен автоматически
axiosInstance.interceptors.request.use(
    (requestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            requestConfig.headers.Authorization = `Token ${token}`;
        }
        
        // Логируем запросы в development режиме
        if (process.env.NODE_ENV === 'development') {
            console.log('API Request:', {
                method: requestConfig.method?.toUpperCase(),
                url: requestConfig.url,
                data: requestConfig.data,
                headers: requestConfig.headers
            });
        }
        
        return requestConfig;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Interceptor для ответов - обработка ошибок
axiosInstance.interceptors.response.use(
    (response) => {
        // Логируем успешные ответы в development режиме
        if (process.env.NODE_ENV === 'development') {
            console.log('API Response:', {
                status: response.status,
                url: response.config.url,
                data: response.data
            });
        }
        
        return response;
    },
    (error) => {
        console.error('API Error:', error);
        
        // Обработка различных типов ошибок
        if (error.response) {
            // Сервер ответил с кодом ошибки
            const { status, data } = error.response;
            
            switch (status) {
                case 401:
                    // Неавторизован - удаляем токен и перенаправляем на логин
                    console.warn('Unauthorized access - removing token');
                    localStorage.removeItem('access_token');
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                    break;
                    
                case 403:
                    // Запрещено
                    console.warn('Access forbidden:', data);
                    if (data.error === 'API is currently disabled.') {
                        // API отключено
                        alert('Система временно недоступна. Попробуйте позже.');
                    }
                    break;
                    
                case 400:
                    // Плохой запрос - ошибки валидации
                    console.warn('Bad request:', data);
                    if (data.errors) {
                        // Ошибки валидации полей
                        const errorMessages = Object.entries(data.errors)
                            .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
                            .join('\n');
                        console.warn('Validation errors:', errorMessages);
                    }
                    break;
                    
                case 404:
                    // Не найдено
                    console.warn('Resource not found:', error.config.url);
                    break;
                    
                case 500:
                    // Внутренняя ошибка сервера
                    console.error('Internal server error:', data);
                    alert('Внутренняя ошибка сервера. Попробуйте позже.');
                    break;
                    
                default:
                    console.error(`HTTP ${status}:`, data);
            }
            
            // Отправляем ошибку на сервер для логирования (если endpoint существует)
            if (config.logErrorUrl && status >= 500) {
                logErrorToServer(error);
            }
            
        } else if (error.request) {
            // Запрос был отправлен, но ответ не получен
            console.error('Network error - no response received:', error.request);
            alert('Ошибка сети. Проверьте подключение к интернету.');
            
        } else {
            // Ошибка при настройке запроса
            console.error('Request setup error:', error.message);
        }
        
        return Promise.reject(error);
    }
);

// Функция для логирования ошибок на сервер
const logErrorToServer = async (error) => {
    try {
        const errorData = {
            error_type: 'frontend_api_error',
            error_message: error.message,
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            response_data: error.response?.data,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            user_id: localStorage.getItem('user_id') || 'anonymous'
        };
        
        // Отправляем без interceptor'ов, чтобы избежать рекурсии
        await axios.post(config.logErrorUrl, errorData, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (logError) {
        console.error('Failed to log error to server:', logError);
    }
};

// Вспомогательная функция для retry запросов
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            console.warn(`Request attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Экспоненциальная задержка
            const waitTime = delay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// Функции для работы с токенами
export const setAuthToken = (token) => {
    if (token) {
        localStorage.setItem('access_token', token);
        axiosInstance.defaults.headers.Authorization = `Token ${token}`;
    } else {
        localStorage.removeItem('access_token');
        delete axiosInstance.defaults.headers.Authorization;
    }
};

export const getAuthToken = () => {
    return localStorage.getItem('access_token');
};

export const isAuthenticated = () => {
    return !!getAuthToken();
};

// Функции для работы с очередями
export const queueAPI = {
    // Присоединиться к очереди
    joinQueue: (queueType, fullName) => 
        axiosInstance.post('/queue/join-queue/', { 
            type: queueType, 
            full_name: fullName 
        }),
    
    // Получить информацию об очередях
    getQueues: () => 
        axiosInstance.get('/queue/queues/'),
    
    // Вызвать следующий талон (только для менеджеров)
    callNext: (queueType) => 
        axiosInstance.post('/queue/call-next/', { type: queueType }),
    
    // Сбросить очередь (только для администраторов)
    resetQueue: (queueType) => 
        axiosInstance.post('/queue/reset-queue/', { type: queueType }),
    
    // Получить текущее состояние обслуживания
    getCurrentServing: () => 
        axiosInstance.get('/queue/current-serving/'),
    
    // Удалить аудиофайл
    deleteAudio: (filename) => 
        axiosInstance.post('/queue/delete-audio/', { audio_filename: filename })
};

// Функции для работы с аутентификацией
export const authAPI = {
    // Вход в систему
    login: (username, password) => 
        axiosInstance.post('/auth/login/', { username, password }),
    
    // Выход из системы
    logout: () => 
        axiosInstance.post('/auth/logout/'),
    
    // Получить профиль пользователя
    getProfile: () => 
        axiosInstance.get('/auth/profile/'),
    
    // Получить статистику менеджера
    getManagerStats: () => 
        axiosInstance.get('/manager/stats/')
};

// Функции для работы с утилитами
export const utilityAPI = {
    // Сгенерировать QR код
    generateQR: () => 
        axiosInstance.get('/queue/generate-qr/', { responseType: 'blob' }),
    
    // Отправить ошибку на сервер
    logError: (errorData) => 
        axiosInstance.post('/log-error/', errorData)
};

export default axiosInstance;