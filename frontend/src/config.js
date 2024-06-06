
const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export const config = {
    fetchQueuesUrl: `${API_BASE_URL}/queue/queues/`,
    queuesSocketUrl: `${WS_BASE_URL}/ws/queues/`,
    generateQrUrl: `${API_BASE_URL}/queue/generate-qr/`,
    logoImageUrl: `${API_BASE_URL}/static/logo.png`,
    joinQueueUrl: `${API_BASE_URL}/queue/join-queue/`,
    logoutRedirectUrl: '/login',
    profileUrl: `${API_BASE_URL}/profile/`,
    callNextUrl: `${API_BASE_URL}/queue/call-next/`,
    wsCallNextUrl: `${WS_BASE_URL}/ws/call-next/`,
};
