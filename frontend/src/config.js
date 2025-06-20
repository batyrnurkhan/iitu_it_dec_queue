// config.js

// Используем ваши Docker порты
const API_BASE_URL = 'http://localhost:8002/api/v2';  // Ваш Django на порту 8002
const WS_BASE_URL = 'ws://localhost:8002';             // WebSocket тоже на 8002

export const config = {
    // Existing URLs
    fetchQueuesUrl: `${API_BASE_URL}/queue/queues/`,
    queuesSocketUrl: `${WS_BASE_URL}/ws/queues/`,
    generateQrUrl: `${API_BASE_URL}/queue/generate-qr/`,
    logoImageUrl: `${API_BASE_URL}/static/logo.png`,
    joinQueueUrl: `${API_BASE_URL}/queue/join-queue/`,
    loginUrl: `${API_BASE_URL}/login/`,
    logoutRedirectUrl: '/logout',
    profileUrl: `${API_BASE_URL}/profile/`,
    callNextUrl: `${API_BASE_URL}/queue/call-next/`,
    wsCallNextUrl: `${WS_BASE_URL}/ws/call-next/`,
    logoutUrl: `${API_BASE_URL}/logout/`,
    logErrorUrl: `${API_BASE_URL}/log-error/`,
    
    // New URLs for enhanced functionality
    deleteAudioUrl: `${API_BASE_URL}/queue/delete-audio/`,
    managerStatsUrl: `${API_BASE_URL}/manager/stats/`,
    resetQueueUrl: `${API_BASE_URL}/queue/reset-queue/`,
    currentServingUrl: `${API_BASE_URL}/queue/current-serving/`,
    
    // WebSocket URLs for different consumers
    displaySocketUrl: `${WS_BASE_URL}/ws/displays/`,
    accountsSocketUrl: `${WS_BASE_URL}/ws/accounts/`,
    
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
    }
};