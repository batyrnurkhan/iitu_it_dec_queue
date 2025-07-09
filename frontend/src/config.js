const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Используем переменные окружения или fallback URL'ы
const API_BASE_URL = process.env.REACT_APP_API_URL ||
    (isDevelopment ? 'http://localhost:8000/api/v2' : 'https://queue.iitu.edu.kz/api/v2');

const WS_BASE_URL = process.env.REACT_APP_WS_URL ||
    (isDevelopment ? 'ws://localhost:8000/ws' : 'wss://queue.iitu.edu.kz/ws');

export const config = {
    // Environment info
    environment: isDevelopment ? 'development' : 'production',
    isDevelopment,
    isProduction,

    // API URLs
    fetchQueuesUrl: `${API_BASE_URL}/queue/queues/`,
    queueTypesUrl: `${API_BASE_URL}/queue/queue-types/`, // НОВЫЙ ENDPOINT
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

    // ОБНОВЛЕННЫЕ Queue type constants
    queueTypes: {
        BACHELOR_GRANT: 'BACHELOR_GRANT',
        BACHELOR_PAID: 'BACHELOR_PAID',
        MASTER: 'MASTER',
        PHD: 'PHD',
        PLATONUS: 'PLATONUS',
        // Оставляем старые для совместимости
        BACHELOR: 'BACHELOR_GRANT',
        COLLEGE_GRANT: 'COLLEGE_GRANT',
    },

    // ОБНОВЛЕННЫЕ Display names
    queueDisplayNames: {
        BACHELOR_GRANT: 'Бакалавр грант',
        BACHELOR_PAID: 'Бакалавр платное',
        MASTER: 'Магистратура',
        PHD: 'PhD',
        PLATONUS: 'Platonus',
        // Алиасы для старого кода
        BACHELOR: 'Бакалавр грант',
        COLLEGE_GRANT: 'Колледж Грант',
    },

    // Queue descriptions
    queueDescriptions: {
        BACHELOR_GRANT: 'Для студентов бакалавриата (грант)',
        BACHELOR_PAID: 'Для студентов бакалавриата (платное)',
        MASTER: 'Для магистрантов и докторантов',
        PHD: 'Для аспирантов и PhD студентов',
        PLATONUS: 'Вопросы по системе PLATONUS',
    },

    // Queue emojis
    queueEmojis: {
        BACHELOR_GRANT: '🎓',
        BACHELOR_PAID: '💳',
        MASTER: '📚',
        PHD: '🔬',
        PLATONUS: '💻',
    },

    // Ticket number ranges (для информации)
    ticketRanges: {
        BACHELOR_GRANT: { min: 1, max: 499 },
        BACHELOR_PAID: { min: 500, max: 599 },
        MASTER: { min: 600, max: 699 },
        PHD: { min: 700, max: 799 },
        PLATONUS: { min: 800, max: 999 },
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

// Helper functions
export const getQueueDisplayName = (queueType) => {
    return config.queueDisplayNames[queueType] || queueType;
};

export const getQueueDescription = (queueType) => {
    return config.queueDescriptions[queueType] || 'Описание недоступно';
};

export const getQueueEmoji = (queueType) => {
    return config.queueEmojis[queueType] || '📋';
};

export const getTicketRange = (queueType) => {
    return config.ticketRanges[queueType] || { min: 1, max: 999 };
};

// Debug info (только в development)
if (isDevelopment) {
    console.log('🔧 Frontend Config:', {
        environment: config.environment,
        apiBaseUrl: API_BASE_URL,
        wsBaseUrl: WS_BASE_URL,
        allUrls: {
            fetchQueues: config.fetchQueuesUrl,
            queueTypes: config.queueTypesUrl,
            joinQueue: config.joinQueueUrl,
            websocket: config.queuesSocketUrl
        },
        queueTypes: config.queueTypes
    });
}