import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import '../styles/profile.css';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { config } from "../config";
import logo from "../static/logo.png";

const roleTranslations = {
    "MANAGER": "Менеджер",
    "ADMIN": "Администратор",
    "USER": "Пользователь",
};

const typeTranslations = {
    "BACHELOR": "Менеджер бакалавра",
    "MASTER": "Менеджер магистратуры/докторантуры",
    "PHD": "Менеджер по регистрации в PLATONUS",
};

function Profile() {
    // State management
    const [userData, setUserData] = useState({});
    const [socket, setSocket] = useState(null);
    const [nextTicket, setNextTicket] = useState(null);
    const [isCallInProgress, setIsCallInProgress] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    const userDataRef = useRef(userData);

    // Update ref when userData changes
    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    // Memoized values
    const translatedRole = useMemo(() =>
        roleTranslations[userData.role] || userData.role, [userData.role]);

    const translatedType = useMemo(() =>
        typeTranslations[userData.manager_type] || userData.manager_type, [userData.manager_type]);

    const queueCount = useMemo(() => {
        if (!userData.ticket_counts || !userData.manager_type) return 0;
        return userData.ticket_counts[userData.manager_type] || 0;
    }, [userData.ticket_counts, userData.manager_type]);

    // Fetch profile data
    const fetchProfileData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const token = localStorage.getItem('access_token');

            if (!token) {
                throw new Error('No access token found');
            }

            const response = await axios.get(config.profileUrl, {
                headers: {
                    'Authorization': `Token ${token}`
                },
                timeout: 10000
            });

            setUserData(response.data);
            setNextTicket(response.data.next_ticket);
            setConnectionStatus('connected');
        } catch (error) {
            console.error("Error fetching profile data:", error);
            setError('Ошибка загрузки данных профиля');
            setConnectionStatus('error');

            // Redirect to login if unauthorized
            if (error.response && error.response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Handle WebSocket message
    const handleWebSocketMessage = useCallback((data) => {
        console.log('WebSocket message:', data);

        if (data.type === "ticket_count_update" && data.data) {
            setUserData(prevState => ({
                ...prevState,
                ticket_counts: data.data.ticket_counts
            }));
        }

        if (data.type === "ticket_called" && data.data) {
            if (data.data.manager_username === userDataRef.current.username) {
                setUserData(prevState => ({
                    ...prevState,
                    last_called_ticket: {
                        number: data.data.ticket_number,
                        full_name: data.data.full_name,
                        queue_type: data.data.queue_type
                    }
                }));
                setIsCallInProgress(false);
            }
        }

        if (data.type === "new_ticket" && data.data) {
            // Обновляем информацию о следующем талоне если это наша очередь
            if (data.data.queue_type === userDataRef.current.manager_type) {
                fetchProfileData(); // Перезагружаем профиль для актуальной информации
            }
        }
    }, [fetchProfileData]);

    // Call next ticket
    const handleCallNext = useCallback(async () => {
        if (isCallInProgress) return;

        setIsCallInProgress(true);
        setError(null);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(config.callNextUrl, {
                type: userData.manager_type
            }, {
                headers: {
                    'Authorization': `Token ${token}`
                },
                timeout: 10000
            });

            setUserData(prevState => ({
                ...prevState,
                last_called_ticket: {
                    number: response.data.ticket_number,
                    full_name: response.data.full_name,
                    queue_type: userData.manager_type
                }
            }));

            // Обновляем информацию о следующем талоне
            fetchProfileData();

            // Haptic feedback для успеха
            if (navigator.vibrate) {
                navigator.vibrate([50, 25, 50, 25, 50]);
            }

            // Fallback таймер на случай если WebSocket не ответит
            setTimeout(() => {
                setIsCallInProgress(false);
            }, 3000);

        } catch (error) {
            console.error("Error calling the next ticket:", error);
            setIsCallInProgress(false);

            // Haptic feedback для ошибки
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            if (error.response && error.response.data.message === "Queue is empty.") {
                setError("Очередь пуста");
            } else if (error.response && error.response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            } else {
                setError("Ошибка при вызове следующего талона");
            }
        }
    }, [isCallInProgress, userData.manager_type, fetchProfileData]);

    // Logout function
    const handleLogout = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            await axios.post(config.logoutUrl, {}, {
                headers: {
                    'Authorization': `Token ${token}`
                },
                timeout: 5000
            });

            console.log("Logout successful");
        } catch (error) {
            console.error("Error during logout:", error);
        } finally {
            localStorage.removeItem('access_token');
            window.location.href = config.logoutRedirectUrl || '/login';
        }
    }, []);

    // Setup WebSocket and initial data fetch
    useEffect(() => {
        const token = localStorage.getItem('access_token');

        if (!token) {
            window.location.href = '/login';
            return;
        }

        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setConnectionStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnectionStatus('error');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setConnectionStatus('disconnected');
        };

        setSocket(ws);
        fetchProfileData();

        return () => {
            ws.close();
        };
    }, [fetchProfileData, handleWebSocketMessage]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Space bar to call next ticket (if manager)
            if (event.code === 'Space' && userData.role === "MANAGER" && !isCallInProgress) {
                event.preventDefault();
                handleCallNext();
            }

            // ESC to clear error
            if (event.key === 'Escape' && error) {
                setError(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [userData.role, isCallInProgress, handleCallNext, error]);

    // Set page title
    useEffect(() => {
        document.title = userData.username ? `Профиль - ${userData.username}` : "Профиль - IITU";
    }, [userData.username]);

    // Loading state
    if (isLoading) {
        return (
            <div className="profile-container">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⏳</div>
                        <div className="text-xl text-white font-semibold">Загрузка профиля...</div>
                        <div className="text-white/80 mt-2">Получение данных пользователя</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`profile-container ${isCallInProgress ? 'calling' : ''}`}>
            <img
                src={logo}
                alt="Логотип IITU"
                className="logo"
                onError={(e) => {
                    e.target.style.display = 'none';
                }}
            />

            {/* Connection status indicator */}
            {connectionStatus !== 'connected' && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-full text-sm font-medium ${
                    connectionStatus === 'error' ? 'bg-red-500 text-white' :
                    connectionStatus === 'disconnected' ? 'bg-yellow-500 text-white' :
                    'bg-blue-500 text-white'
                }`}>
                    {connectionStatus === 'error' ? '❌ Ошибка подключения' :
                     connectionStatus === 'disconnected' ? '⚠️ Подключение потеряно' :
                     '🔄 Подключение...'}
                </div>
            )}

            <div className="profile-card">
                {/* Заголовок профиля */}
                <div className="profile-header">
                    <h1 className="profile-username">{userData.username || 'Пользователь'}</h1>
                    <div className="profile-status">Онлайн</div>
                </div>

                {/* Детали профиля */}
                <div className="profile-details">
                    <div className="profile-detail">
                        <span className="detail-label" data-type="role">Роль</span>
                        <span className="detail-value">{translatedRole}</span>
                    </div>

                    {userData.manager_type && (
                        <div className="profile-detail">
                            <span className="detail-label" data-type="type">Тип менеджера</span>
                            <span className="detail-value">{translatedType}</span>
                        </div>
                    )}

                    {userData.role === "MANAGER" && (
                        <div className="profile-detail">
                            <span className="detail-label" data-type="queue">
                                Количество талонов в очереди
                            </span>
                            <span className="detail-value">
                                {queueCount > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        color: 'var(--primary-600)'
                                    }}>
                                        <span>🎫</span>
                                        <span>{queueCount}</span>
                                        <span style={{fontSize: '0.875rem', fontWeight: '400'}}>
                                            {queueCount === 1 ? 'талон' :
                                             queueCount < 5 ? 'талона' : 'талонов'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="empty-queue">
                                        <span className="empty-queue-icon">📭</span>
                                        <div className="empty-queue-text">Очередь пустая</div>
                                        <div className="empty-queue-subtitle">Ожидание новых талонов</div>
                                    </div>
                                )}
                            </span>
                        </div>
                    )}
                </div>

                {/* Информация о следующем талоне */}
                {userData.role === "MANAGER" && nextTicket && (
                    <div className="next-ticket-info">
                        <h3>Следующий в очереди</h3>
                        <div className="next-ticket-details">
                            <p>
                                <strong>ФИО:</strong>
                                <span>{nextTicket.full_name}</span>
                            </p>
                            <p>
                                <strong>Номер талона:</strong>
                                <span>{nextTicket.number}</span>
                            </p>
                            <p>
                                <strong>Время создания:</strong>
                                <span>{new Date(nextTicket.created_at).toLocaleString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit'
                                })}</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Секция вызова талонов */}
                {userData.role === "MANAGER" && (
                    <div className="call-next">
                        {userData.last_called_ticket ? (
                            <div className="current-serving">
                                <span className="detail-label">Сейчас обслуживается</span>
                                <div className="serving-info">
                                    <div className="serving-name">
                                        {userData.last_called_ticket.full_name}
                                    </div>
                                    <div className="serving-ticket">
                                        Талон №{userData.last_called_ticket.number}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center mb-6">
                                <div className="empty-queue">
                                    <span className="empty-queue-icon">👤</span>
                                    <div className="empty-queue-text">Никто не обслуживается</div>
                                    <div className="empty-queue-subtitle">Вызовите первый талон</div>
                                </div>
                            </div>
                        )}

                        {queueCount > 0 ? (
                            <button
                                className={`call-next-button ${isCallInProgress ? 'loading' : ''}`}
                                onClick={handleCallNext}
                                disabled={isCallInProgress}
                                aria-label={isCallInProgress ? 'Вызов талона в процессе' : 'Вызвать следующий талон'}
                                title="Нажмите или используйте пробел для вызова"
                            >
                                {isCallInProgress ? (
                                    <>
                                        <span>⏳</span>
                                        <span>Вызов...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>📢</span>
                                        <span>Следующий талон</span>
                                        <span style={{fontSize: '0.875rem', opacity: 0.8}}>(Пробел)</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="text-center">
                                <div style={{
                                    padding: 'var(--space-6)',
                                    background: 'var(--gray-100)',
                                    borderRadius: 'var(--radius-lg)',
                                    color: 'var(--text-muted)'
                                }}>
                                    <div style={{fontSize: '2rem', marginBottom: 'var(--space-2)'}}>⏸️</div>
                                    <div style={{fontSize: '1rem', fontWeight: '500'}}>
                                        Нет талонов для вызова
                                    </div>
                                    <div style={{fontSize: '0.875rem', marginTop: 'var(--space-1)'}}>
                                        Ожидайте новых клиентов
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Сообщение об ошибке */}
                {error && (
                    <div style={{
                        padding: 'var(--space-4)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-lg)',
                        color: 'var(--error)',
                        marginBottom: 'var(--space-6)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)'
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            style={{
                                marginLeft: 'auto',
                                background: 'none',
                                border: 'none',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                padding: 'var(--space-1)'
                            }}
                            aria-label="Закрыть ошибку"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Секция выхода */}
                <div className="logout-section">
                    <button
                        onClick={handleLogout}
                        className="logout-button"
                        aria-label="Выйти из системы"
                    >
                        Выйти из системы
                    </button>
                </div>
            </div>

            {/* Скрытый элемент для screen readers */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {isCallInProgress && "Вызов следующего талона в процессе"}
                {error && `Ошибка: ${error}`}
                {userData.last_called_ticket &&
                    `Сейчас обслуживается: ${userData.last_called_ticket.full_name}, талон номер ${userData.last_called_ticket.number}`
                }
            </div>
        </div>
    );
}

export default Profile;