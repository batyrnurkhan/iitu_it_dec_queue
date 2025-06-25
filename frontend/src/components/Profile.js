import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import '../styles/profile.css';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { config, getQueueDisplayName, getQueueEmoji } from "../config";
import logo from "../static/logo.png";
import '../styles/profile.css'
const roleTranslations = {
    "MANAGER": "Менеджер",
    "ADMIN": "Администратор",
    "USER": "Пользователь",
};

function Profile() {
    // State management
    const [userData, setUserData] = useState({});
    const [socket, setSocket] = useState(null);
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

    // ОБНОВЛЕННАЯ логика для allowedQueueTypes с фоллбэком
    const allowedQueueTypes = useMemo(() => {
        // Новая логика - если есть allowed_queue_types, используем их
        if (userData.allowed_queue_types && userData.allowed_queue_types.length > 0) {
            console.log('Using allowed_queue_types:', userData.allowed_queue_types);
            return userData.allowed_queue_types;
        }

        // Фоллбэк на старую логику - если есть manager_type
        if (userData.manager_type) {
            console.log('Fallback to manager_type:', userData.manager_type);
            return [userData.manager_type];
        }

        console.log('No queue types found!');
        return [];
    }, [userData.allowed_queue_types, userData.manager_type]);

    const totalQueueCount = useMemo(() => {
        if (!userData.ticket_counts) return 0;
        return Object.values(userData.ticket_counts).reduce((sum, count) => sum + count, 0);
    }, [userData.ticket_counts]);

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
                ticket_counts: {
                    ...prevState.ticket_counts,
                    ...data.data.ticket_counts
                }
            }));
        }

        if (data.type === "ticket_called" && data.data) {
            if (data.data.manager_username === userDataRef.current.username) {
                setUserData(prevState => ({
                    ...prevState,
                    last_called_ticket: {
                        number: data.data.ticket_number,
                        full_name: data.data.full_name,
                        queue_type: data.data.queue_type,
                        queue_type_display: data.data.queue_type_display
                    }
                }));
                setIsCallInProgress(false);
            }
        }

        if (data.type === "new_ticket" && data.data) {
            // Обновляем если новый талон относится к нашим очередям
            if (userDataRef.current.allowed_queue_types?.includes(data.data.queue_type)) {
                fetchProfileData();
            }
        }
    }, [fetchProfileData]);

    // ОБНОВЛЕННАЯ функция handleCallNext с поддержкой конкретного типа очереди
    const handleCallNext = useCallback(async (specificQueueType = null) => {
        console.log('=== DEBUG handleCallNext ===');
        console.log('isCallInProgress:', isCallInProgress);
        console.log('allowedQueueTypes:', allowedQueueTypes);
        console.log('specificQueueType:', specificQueueType);

        if (isCallInProgress || allowedQueueTypes.length === 0) {
            console.log('Early return - isCallInProgress:', isCallInProgress, 'allowedQueueTypes.length:', allowedQueueTypes.length);
            return;
        }

        let queueTypeToCall;

        if (specificQueueType) {
            // Конкретная очередь выбрана
            queueTypeToCall = specificQueueType;
        } else if (allowedQueueTypes.length === 1) {
            // Только одна доступная очередь
            queueTypeToCall = allowedQueueTypes[0];
        } else {
            // Автовыбор очереди с талонами (для backward compatibility)
            queueTypeToCall = allowedQueueTypes.find(type =>
                userData.ticket_counts?.[type] > 0
            ) || allowedQueueTypes[0];
        }

        console.log('Final queueTypeToCall:', queueTypeToCall);

        setIsCallInProgress(true);
        setError(null);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(config.callNextUrl, {
                type: queueTypeToCall
            }, {
                headers: {
                    'Authorization': `Token ${token}`
                },
                timeout: 10000
            });

            console.log('API Response:', response.data);

            if (response.data.message === "Queue is empty.") {
                setError(`Очередь ${getQueueDisplayName(queueTypeToCall)} пуста`);
                setIsCallInProgress(false);
                return;
            }

            setUserData(prevState => ({
                ...prevState,
                last_called_ticket: {
                    number: response.data.ticket_number,
                    full_name: response.data.full_name,
                    queue_type: queueTypeToCall,
                    queue_type_display: response.data.queue_type_display || getQueueDisplayName(queueTypeToCall)
                }
            }));

            // Обновляем информацию
            fetchProfileData();

            // Haptic feedback для успеха
            if (navigator.vibrate) {
                navigator.vibrate([50, 25, 50, 25, 50]);
            }

            // Fallback таймер
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

            if (error.response && error.response.status === 403) {
                setError(`У вас нет прав на обслуживание очереди ${getQueueDisplayName(queueTypeToCall)}`);
            } else if (error.response && error.response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            } else {
                setError("Ошибка при вызове следующего талона");
            }
        }
    }, [isCallInProgress, allowedQueueTypes, userData.ticket_counts, fetchProfileData]);

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
            // Space bar to call next ticket (if manager and only one queue)
            if (event.code === 'Space' && userData.role === "MANAGER" && !isCallInProgress && allowedQueueTypes.length === 1) {
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
    }, [userData.role, isCallInProgress, handleCallNext, error, allowedQueueTypes.length]);

    // Set page title
    useEffect(() => {
        document.title = userData.username ? `Профиль - ${userData.username}` : "Профиль - IITU";
    }, [userData.username]);

    // Debug log
    useEffect(() => {
        console.log('Profile Debug Info:');
        console.log('userData:', userData);
        console.log('allowedQueueTypes:', allowedQueueTypes);
        console.log('userData.allowed_queue_types:', userData.allowed_queue_types);
        console.log('userData.manager_type:', userData.manager_type);
        console.log('userData.ticket_counts:', userData.ticket_counts);
    }, [userData, allowedQueueTypes]);

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

                    {userData.workplace && (
                        <div className="profile-detail">
                            <span className="detail-label" data-type="workplace">Рабочее место</span>
                            <span className="detail-value">{userData.workplace}</span>
                        </div>
                    )}

                    {userData.role === "MANAGER" && allowedQueueTypes.length > 0 && (
                        <div className="profile-detail">
                            <span className="detail-label" data-type="queue">
                                Доступные очереди
                            </span>
                            <div className="allowed-queues-display">
                                {allowedQueueTypes.map(queueType => (
                                    <div key={queueType} className="queue-badge">
                                        <span className="queue-emoji">{getQueueEmoji(queueType)}</span>
                                        <span className="queue-name">{getQueueDisplayName(queueType)}</span>
                                        <span className="queue-count">
                                            {userData.ticket_counts?.[queueType] || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ОБНОВЛЕННАЯ секция вызова талонов */}
                {userData.role === "MANAGER" && allowedQueueTypes.length > 0 && (
                    <div className="call-next">
                        {userData.last_called_ticket ? (
                            <div className="current-serving">
                                <span className="detail-label">Последний вызванный талон</span>
                                <div className="serving-info">
                                    <div className="serving-name">
                                        {userData.last_called_ticket.full_name}
                                    </div>
                                    <div className="serving-ticket">
                                        Талон №{userData.last_called_ticket.number}
                                    </div>
                                    <div className="serving-queue">
                                        {userData.last_called_ticket.queue_type_display ||
                                         getQueueDisplayName(userData.last_called_ticket.queue_type)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center mb-6">
                                <div className="empty-queue">
                                    <span className="empty-queue-icon">👤</span>
                                    <div className="empty-queue-text">Талоны еще не вызывались</div>
                                    <div className="empty-queue-subtitle">
                                        {allowedQueueTypes.length > 1 ? 'Выберите очередь для вызова талона' : 'Нажмите кнопку для вызова следующего талона'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* НОВАЯ ЛОГИКА: Кнопки для каждой доступной очереди */}
                        {allowedQueueTypes.length > 1 ? (
                            // Множественные очереди - показываем отдельные кнопки
                            <div className="queue-selection">
                                <h3 className="queue-selection-title">Выберите очередь:</h3>
                                <div className="queue-buttons">
                                    {allowedQueueTypes.map(queueType => {
                                        const count = userData.ticket_counts?.[queueType] || 0;
                                        return (
                                            <button
                                                key={queueType}
                                                className={`queue-call-button ${count === 0 ? 'disabled' : ''} ${isCallInProgress ? 'loading' : ''}`}
                                                onClick={() => handleCallNext(queueType)}
                                                disabled={isCallInProgress || count === 0}
                                                title={`Вызвать следующий талон из очереди ${getQueueDisplayName(queueType)}`}
                                            >
                                                <div className="queue-button-content">
                                                    <span className="queue-emoji">{getQueueEmoji(queueType)}</span>
                                                    <div className="queue-info">
                                                        <div className="queue-name">{getQueueDisplayName(queueType)}</div>
                                                        <div className="queue-count">
                                                            {count > 0 ? `${count} ${count === 1 ? 'талон' : count < 5 ? 'талона' : 'талонов'}` : 'Пусто'}
                                                        </div>
                                                    </div>
                                                    {isCallInProgress ? (
                                                        <span className="loading-icon">⏳</span>
                                                    ) : (
                                                        <span className="call-icon">📢</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            // Одна очередь - обычная кнопка
                            totalQueueCount > 0 ? (
                                <button
                                    className={`call-next-button ${isCallInProgress ? 'loading' : ''}`}
                                    onClick={() => handleCallNext()}
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
                                            <span>Вызвать следующий талон</span>
                                            <span style={{fontSize: '0.875rem', opacity: 0.8}}>
                                                (Всего: {totalQueueCount})
                                            </span>
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
                                        <div style={{fontSize: '2rem', marginBottom: 'var(--space-2)'}}>📭</div>
                                        <div style={{fontSize: '1rem', fontWeight: '500'}}>
                                            Все очереди пусты
                                        </div>
                                        <div style={{fontSize: '0.875rem', marginTop: 'var(--space-1)'}}>
                                            Ожидайте новых талонов
                                        </div>
                                    </div>
                                </div>
                            )
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
                    `Последний вызванный: ${userData.last_called_ticket.full_name}, талон номер ${userData.last_called_ticket.number}`
                }
            </div>
        </div>
    );
}

export default Profile;