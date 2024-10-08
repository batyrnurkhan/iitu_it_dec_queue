
const API_BASE_URL = 'https://queue.iitu.edu.kz/api/v2';
const WS_BASE_URL = 'wss://queue.iitu.edu.kz';

export const config = {
    fetchQueuesUrl: `${API_BASE_URL}/queue/queues/`,
    queuesSocketUrl: `${WS_BASE_URL}/ws/queues/`,
    generateQrUrl: `${API_BASE_URL}/queue/generate-qr/`,
    logoImageUrl: `${API_BASE_URL}/static/logo.png`,
    joinQueueUrl: `${API_BASE_URL}/queue/join-queue/`,
    loginUrl: `${API_BASE_URL}/login/`,
    logoutRedirectUrl: '/login',
    profileUrl: `${API_BASE_URL}/profile/`,
    callNextUrl: `${API_BASE_URL}/queue/call-next/`,
    wsCallNextUrl: `${WS_BASE_URL}/ws/call-next/`,
    logoutUrl: `${API_BASE_URL}/logout/`,
    logErrorUrl: `${API_BASE_URL}/log-error/`,
};
