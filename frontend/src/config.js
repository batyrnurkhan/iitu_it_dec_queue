// config.js

// Используем переменные окружения или production URL'ы
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://queue.iitu.edu.kz/api/v2';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'wss://queue.iitu.edu.kz';

export const config = {
    // API URLs
    fetchQueuesUrl: `${API_BASE_URL}/queue/queues/`,
    generateQrUrl: `${API_BASE_URL}/queue/generate-qr/`,
    logoImageUrl: `${API_BASE_URL}/static/logo.png`,
    joinQueueUrl: `${API_BASE_URL}/queue/join-queue/`,
    loginUrl: `${API_BASE_URL}/login/`,
    logoutRedirectUrl: '/logout',
    profileUrl: `${API_BASE_URL}/profile/`,
    callNextUrl: `${API_BASE_URL}/queue/call-next/`,
    logoutUrl: `${API_BASE_URL}/logout/`,
    logErrorUrl: `${API_BASE_URL}/log-error/`,
    deleteAudioUrl: `${API_BASE_URL}/queue/delete-audio/`,
    managerStatsUrl: `${API_BASE_URL}/manager/stats/`,
    resetQueueUrl: `${API_BASE_URL}/queue/reset-queue/`,
    currentServingUrl: `${API_BASE_URL}/queue/current-serving/`,

    // WebSocket URLs
    queuesSocketUrl: `${WS_BASE_URL}/queues/`,
    wsCallNextUrl: `${WS_BASE_URL}/call-next/`,
    displaySocketUrl: `${WS_BASE_URL}/displays/`,
    accountsSocketUrl: `${WS_BASE_URL}/accounts/`,

    // Queue type constants
    queueTypes: {
        BACHELOR: 'BACHELOR',
        MASTER: 'MASTER',
        PHD: 'PHD'
    },

    queueDisplayNames: {
        BACHELOR: 'Бакалавр',
        MASTER: 'Маг./Докт.',
        PHD: 'PLATONUS'
    },

    // Notification settings
    notifications: {
        enabled: true,
        icon: '/static/logo.png',
        badge: '/static/logo.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
    },

    // API settings
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,

    // WebSocket settings
    websocket: {
        reconnectInterval: 1000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
    },

    // Базовые URL'ы для axiosInstance
    apiBaseUrl: API_BASE_URL,
    wsBaseUrl: WS_BASE_URL
};