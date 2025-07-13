import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { config, getQueueDisplayName } from "../config";
import logo from "../static/logo.png";
import '../styles/TicketDisplayPage.css';

// Safe import of NotificationService
let notificationService;
try {
    notificationService = require('../services/NotificationService').default;
} catch (error) {
    console.warn('NotificationService failed to load, using fallback:', error);
    notificationService = {
        setUserTicketInfo: (info) => {
            try {
                localStorage.setItem('current_ticket_info', JSON.stringify(info));
            } catch (e) {
                console.log('Fallback: setUserTicketInfo', info);
            }
        },
        clearUserTicketInfo: () => {
            try {
                localStorage.removeItem('current_ticket_info');
            } catch (e) {
                console.log('Fallback: clearUserTicketInfo');
            }
        },
        showTicketCalledNotification: (data) => {
            console.log('Fallback: showTicketCalledNotification', data);

            // Vibration
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }

            // Show confirm for audio playback
            setTimeout(() => {
                if (window.confirm(`🔔 ВАШ ТАЛОН ВЫЗВАН!\n${data.full_name}\nНажмите OK для воспроизведения аудио`)) {
                    if (data.audio_url) {
                        const audio = new Audio(data.audio_url);
                        audio.play().catch(err => console.log('Audio play failed:', err));
                    }
                }
            }, 500);
        }
    };
}

function TicketDisplayPage() {
    document.title = "Ваш талон - IITU";

    const location = useLocation();
    const navigate = useNavigate();
    const {
        ticketNumber,
        queueType,
        queueTypeDisplay,
        ticketId,
        fullName,
        token
    } = location.state || {};

    const [socket, setSocket] = useState(null);
    const [queueStatus, setQueueStatus] = useState('waiting');
    const [currentlyServing, setCurrentlyServing] = useState(null);
    const [queuePosition, setQueuePosition] = useState(null);
    const [estimatedWaitTime, setEstimatedWaitTime] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Check ticket data validity
    useEffect(() => {
        if (!ticketId || !ticketNumber || !fullName || !queueType) {
            console.warn('Missing ticket data, redirecting to home');
            navigate('/', { replace: true });
        }
    }, [ticketId, ticketNumber, fullName, queueType, navigate]);

    const updateQueuePosition = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(config.fetchQueuesUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                console.error('API returned non-array data:', data);
                return;
            }

            // Find our queue by type or display name
            const ourQueue = data.find(queue =>
                queue['queue_type_code'] === queueType ||
                queue['Очередь'] === (queueTypeDisplay || getQueueDisplayName(queueType))
            );

            if (ourQueue && ourQueue['Зарегестрированные талоны']) {
                const tickets = ourQueue['Зарегестрированные талоны'];
                const ourIndex = tickets.findIndex(ticket =>
                    ticket.number === ticketNumber || ticket.full_name === fullName
                );

                if (ourIndex !== -1) {
                    setQueuePosition(ourIndex + 1);
                    setEstimatedWaitTime(ourIndex * 2.5);
                } else {
                    // Check saved status
                    const savedStatus = localStorage.getItem(`ticket_${ticketId}_status`);
                    if (!savedStatus || !['called', 'missed'].includes(JSON.parse(savedStatus).status)) {
                        setQueueStatus('completed');
                    }
                }
            }
        } catch (error) {
            console.error("Error updating queue position:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Main initialization logic
    useEffect(() => {
        // Cleanup old ticket statuses
        const cleanupOldTicketStatuses = () => {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('ticket_') && key.endsWith('_status')) {
                    try {
                        const statusData = JSON.parse(localStorage.getItem(key));
                        const actionTime = new Date(statusData.calledAt || statusData.missedAt || statusData.completedAt);
                        const now = new Date();
                        const hoursDiff = (now - actionTime) / (1000 * 60 * 60);

                        if (hoursDiff > 24) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        localStorage.removeItem(key);
                    }
                }
            });
        };

        cleanupOldTicketStatuses();

        // Restore state from localStorage
        if (ticketId) {
            const savedStatus = localStorage.getItem(`ticket_${ticketId}_status`);
            if (savedStatus) {
                try {
                    const statusData = JSON.parse(savedStatus);
                    const actionTime = new Date(statusData.calledAt || statusData.missedAt || statusData.completedAt);
                    const now = new Date();
                    const hoursDiff = (now - actionTime) / (1000 * 60 * 60);

                    if (hoursDiff < 4) {
                        setQueueStatus(statusData.status);
                        if (statusData.currentlyServing) {
                            setCurrentlyServing(statusData.currentlyServing);
                        }
                        console.log('Restored ticket status from localStorage:', statusData);
                    }
                } catch (error) {
                    console.error('Error parsing saved ticket status:', error);
                }
            }
        }

        // Save ticket info
        if (ticketId && ticketNumber && fullName && queueType) {
            const ticketInfo = {
                ticketId,
                ticketNumber,
                fullName,
                queueType,
                queueTypeDisplay: queueTypeDisplay || getQueueDisplayName(queueType),
                token,
                createdAt: new Date().toISOString()
            };
            notificationService.setUserTicketInfo(ticketInfo);
        }

        // WebSocket connection
        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onopen = () => {
            console.log('WebSocket connected for ticket tracking');
            updateQueuePosition();
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket message on ticket page:', data);

                if (data.type === "ticket_called" && data.data) {
                    const isOurTicket = data.data.ticket_id === ticketId ||
                        (data.data.ticket_number === ticketNumber && data.data.full_name === fullName);

                    if (isOurTicket) {
                        // Our ticket was called
                        const currentlyServingData = {
                            full_name: data.data.full_name,
                            ticket_number: data.data.ticket_number,
                            manager_username: data.data.manager_username,
                            queue_type_display: data.data.queue_type_display
                        };

                        setQueueStatus('called');
                        setCurrentlyServing(currentlyServingData);

                        // Save status
                        const ticketStatus = {
                            status: 'called',
                            currentlyServing: currentlyServingData,
                            calledAt: new Date().toISOString()
                        };
                        localStorage.setItem(`ticket_${ticketId}_status`, JSON.stringify(ticketStatus));

                        // Show notification
                        notificationService.showTicketCalledNotification(data.data);

                        // Play audio
                        if (data.data.audio_url) {
                            const audio = new Audio(data.data.audio_url);
                            audio.play().catch(error => {
                                console.error("Error playing audio:", error);
                            });
                        }

                        // Haptic feedback
                        if (navigator.vibrate) {
                            navigator.vibrate([200, 100, 200, 100, 200]);
                        }

                        notificationService.clearUserTicketInfo();

                    } else if (queueStatus === 'called') {
                        // Another ticket was called, ours was missed
                        console.log('Another ticket was called, marking our ticket as missed');

                        setQueueStatus('missed');

                        const missedStatus = {
                            status: 'missed',
                            missedAt: new Date().toISOString(),
                            reason: 'another_ticket_called',
                            nextCalledTicket: {
                                ticket_number: data.data.ticket_number,
                                full_name: data.data.full_name
                            }
                        };
                        localStorage.setItem(`ticket_${ticketId}_status`, JSON.stringify(missedStatus));

                        // Missed notification
                        if (navigator.vibrate) {
                            navigator.vibrate([100, 50, 100, 50, 100]);
                        }

                        alert('⚠️ Ваш талон был пропущен! Вызван следующий талон.');
                        notificationService.clearUserTicketInfo();
                    }
                }

                // Handle ticket superseded event
                if (data.type === "ticket_superseded" && data.data) {
                    const isOurTicket = data.data.previous_ticket_id === ticketId ||
                        (data.data.previous_ticket_number === ticketNumber && data.data.previous_full_name === fullName);

                    if (isOurTicket && queueStatus === 'called') {
                        console.log('Our ticket was superseded by a new call');

                        setQueueStatus('missed');

                        const missedStatus = {
                            status: 'missed',
                            missedAt: data.data.superseded_at,
                            reason: data.data.reason || 'superseded'
                        };
                        localStorage.setItem(`ticket_${ticketId}_status`, JSON.stringify(missedStatus));

                        alert('⚠️ Ваш талон был заменен новым вызовом!');
                        notificationService.clearUserTicketInfo();
                    }
                }

                if (data.type === "ticket_count_update" && data.data) {
                    updateQueuePosition();
                }

            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        };

        setSocket(ws);

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [ticketId, ticketNumber, fullName, queueType, token, queueStatus]);


const getManagerLocation = (managerUsername) => {
    if (!managerUsername) return 'менеджеру';

    const username = managerUsername.toLowerCase();

    if (username.startsWith('stol')) {
        const stolNumber = username.replace('stol', '');
        return `столу ${stolNumber}`;
    } else if (username.startsWith('cabinet')) {
        const cabinetNumber = username.replace('cabinet', '');
        return `кабинет ${cabinetNumber}`;
    } else {
        const match = username.match(/\d+$/);
        const number = match ? match[0] : '';
        return number ? `столу ${number}` : 'менеджеру';
    }
};

    const formatWaitTime = (minutes) => {
        if (minutes < 60) {
            return `${Math.round(minutes)} мин.`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `${hours} ч. ${mins} мин.`;
        }
    };

    const handleRefresh = () => {
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        updateQueuePosition();
    };

    const handleGoHome = () => {
        navigate('/', { replace: true });
    };

    const handleGetNewTicket = () => {
        navigate('/join-queue', { replace: true });
    };

    const handleContactManager = () => {
        const phone = '+77172000000'; // Replace with real number
        if (window.confirm('Позвонить администратору?')) {
            window.location.href = `tel:${phone}`;
        }
    };

    return (
        <div className="ticket-display-container">
            <img
                src={logo}
                alt="Логотип IITU"
                className="ticket-display-logo"
                onError={(e) => {
                    e.target.style.display = 'none';
                }}
            />

            <div className="ticket-card">
                {/* Header */}
                <div className="ticket-header">
                    <h1 className="ticket-title">
                        <span>🎫</span>
                        <span>Ваш талон</span>
                    </h1>
                    {queueStatus === 'called' && (
                        <div className="status-badge called">
                            🔔 ТАЛОН ВЫЗВАН!
                        </div>
                    )}
                    {queueStatus === 'waiting' && (
                        <div className="status-badge waiting">
                            ⏳ Ожидание
                        </div>
                    )}
                </div>

                {/* Ticket information */}
                <div className="ticket-info">
                    <div className="ticket-main-info">
                        <div className="info-item">
                            <span className="info-label">
                                <span>👤</span>
                                <span>ФИО</span>
                            </span>
                            <span className="info-value">{fullName}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">
                                <span>🎫</span>
                                <span>Номер талона</span>
                            </span>
                            <span className="info-value">{ticketNumber}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">
                                <span>📋</span>
                                <span>Тип очереди</span>
                            </span>
                            <span className="info-value">{getDisplayQueueName()}</span>
                        </div>
                    </div>
                </div>

                {/* Queue status */}
                <div className="queue-status">
                    {queueStatus === 'waiting' && (
                        <div className="status-waiting">
                            <h3>
                                <span>⏳</span>
                                <span>Ожидание в очереди</span>
                            </h3>
                            {queuePosition && (
                                <div className="position-info">
                                    <p>Ваша позиция в очереди:</p>
                                    <span className="position-highlight">{queuePosition}</span>
                                    {estimatedWaitTime && (
                                        <p>Примерное время ожидания: <strong>{formatWaitTime(estimatedWaitTime)}</strong></p>
                                    )}
                                </div>
                            )}
                            <div className="waiting-message">
                                <p>Ожидайте вызова. Ваше ФИО будет объявлено, когда подойдет ваша очередь.</p>
                                <div className="status-indicator">
                                    <div className="spinner"></div>
                                    <span>Ожидание вызова...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {queueStatus === 'called' && currentlyServing && (
                        <div className="status-called">
                            <h3>🔔 ВАШ ТАЛОН ВЫЗВАН!</h3>
                            <div className="call-info">
                                <p className="call-message">
                                    <strong>{currentlyServing.full_name}</strong>,
                                    подойдите к {getManagerLocation(currentlyServing.manager_username)}
                                </p>
                                <div className="urgency-indicator">
                                    <span className="blink">⚠️ НЕМЕДЛЕННО ПОДОЙДИТЕ К МЕНЕДЖЕРУ ⚠️</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {queueStatus === 'completed' && (
                        <div className="status-completed">
                            <h3>✅ Обслуживание завершено</h3>
                            <p>Спасибо за использование электронной очереди IITU!</p>
                        </div>
                    )}

                    {queueStatus === 'missed' && (
                        <div className="status-missed">
                            <h3>⚠️ ТАЛОН ПРОПУЩЕН</h3>
                            <div className="missed-info">
                                <p>Ваш талон был пропущен, так как был вызван следующий талон.</p>
                                <p>Возможные действия:</p>
                                <ul>
                                    <li>Подойдите к любому свободному менеджеру</li>
                                    <li>Получите новый талон</li>
                                    <li>Обратитесь к администратору</li>
                                </ul>
                            </div>

                            <div className="missed-actions">
                                <button
                                    className="get-new-ticket-button"
                                    onClick={handleGetNewTicket}
                                    type="button"
                                >
                                    🎫 Получить новый талон
                                </button>

                                <button
                                    className="contact-manager-button"
                                    onClick={handleContactManager}
                                    type="button"
                                >
                                    📞 Связаться с администратором
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="ticket-actions">
                    <button
                        className="refresh-button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        type="button"
                        aria-label="Обновить статус талона"
                    >
                        {isLoading ? 'Обновление...' : 'Обновить статус'}
                    </button>

                    <button
                        className="home-button"
                        onClick={handleGoHome}
                        type="button"
                        aria-label="Вернуться на главную"
                    >
                        На главную
                    </button>
                </div>

                {/* Footer */}
                <div className="ticket-footer">
                    <p className="footer-text">
                        💡 Сохраните эту страницу или сделайте скриншот для отслеживания статуса
                    </p>
                    <p className="footer-warning">
                        ⚠️ Не покидайте здание до завершения обслуживания
                    </p>
                </div>
            </div>
        </div>
    );
}

export default TicketDisplayPage;