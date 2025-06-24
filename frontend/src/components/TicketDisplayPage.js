import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import '../styles/TicketDisplayPage.css';
import { config } from "../config";
import logo from "../static/logo.png";

let notificationService;
try {
    notificationService = require('../services/NotificationService').default;
} catch (error) {
    console.warn('NotificationService failed to load, using fallback:', error);
    // Создаем fallback объект
    notificationService = {
        setUserTicketInfo: (info) => {
            console.log('Fallback: setUserTicketInfo', info);
        },
        clearUserTicketInfo: () => {
            console.log('Fallback: clearUserTicketInfo');
        },
        showTicketCalledNotification: (data) => {
            console.log('Fallback: showTicketCalledNotification', data);
            // Вибрация
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
            // Простое уведомление
            alert(`🔔 ВАШ ТАЛОН ВЫЗВАН!\n${data.full_name}, подойдите к менеджеру`);
        }
    };
}

function TicketDisplayPage() {
    document.title = "TICKET";

    const location = useLocation();
    const { ticketNumber, queueType, ticketId, fullName, token } = location.state || {};

    const [socket, setSocket] = useState(null);
    const [queueStatus, setQueueStatus] = useState('waiting');
    const [currentlyServing, setCurrentlyServing] = useState(null);
    const [queuePosition, setQueuePosition] = useState(null);
    const [estimatedWaitTime, setEstimatedWaitTime] = useState(null);

    const updateQueuePosition = async () => {
    try {
        const response = await fetch(config.fetchQueuesUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('API returned non-array data:', data);
            return;
        }

        const ourQueue = data.find(queue => queue['Очередь'] === queueType);
        if (ourQueue && ourQueue['Зарегестрированные талоны']) {
            const tickets = ourQueue['Зарегестрированные талоны'];
            const ourIndex = tickets.findIndex(ticket =>
                ticket.number === ticketNumber || ticket.full_name === fullName
            );

            if (ourIndex !== -1) {
                setQueuePosition(ourIndex + 1);
                setEstimatedWaitTime(ourIndex * 2.5);
            } else {
                // Проверяем, не сохранен ли статус "called"
                const savedStatus = localStorage.getItem(`ticket_${ticketId}_status`);
                if (!savedStatus || JSON.parse(savedStatus).status !== 'called') {
                    setQueueStatus('completed');
                }
            }
        }
    } catch (error) {
        console.error("Error updating queue position:", error);
    }
};

    useEffect(() => {
    // Очищаем старые статусы
    const cleanupOldTicketStatuses = () => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('ticket_') && key.endsWith('_status')) {
                try {
                    const statusData = JSON.parse(localStorage.getItem(key));
                    const calledAt = new Date(statusData.calledAt);
                    const now = new Date();
                    const hoursDiff = (now - calledAt) / (1000 * 60 * 60);

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

    // Восстанавливаем состояние из localStorage
    if (ticketId) {
        const savedStatus = localStorage.getItem(`ticket_${ticketId}_status`);
        if (savedStatus) {
            try {
                const statusData = JSON.parse(savedStatus);
                const calledAt = new Date(statusData.calledAt);
                const now = new Date();
                const hoursDiff = (now - calledAt) / (1000 * 60 * 60);

                if (hoursDiff < 2) { // Статус актуален менее 2 часов
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

    // Сохраняем информацию о талоне для уведомлений
    if (ticketId && ticketNumber && fullName && queueType) {
        const ticketInfo = {
            ticketId,
            ticketNumber,
            fullName,
            queueType,
            token,
            createdAt: new Date().toISOString()
        };
        notificationService.setUserTicketInfo(ticketInfo);
    }

    // Устанавливаем WebSocket соединение
    const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message on ticket page:', data);

        if (data.type === "ticket_called" && data.data) {
            if (data.data.ticket_id === ticketId ||
                (data.data.ticket_number === ticketNumber && data.data.full_name === fullName)) {

                const currentlyServingData = {
                    full_name: data.data.full_name,
                    ticket_number: data.data.ticket_number,
                    manager_username: data.data.manager_username
                };

                setQueueStatus('called');
                setCurrentlyServing(currentlyServingData);

                // Сохраняем статус в localStorage
                const ticketStatus = {
                    status: 'called',
                    currentlyServing: currentlyServingData,
                    calledAt: new Date().toISOString()
                };
                localStorage.setItem(`ticket_${ticketId}_status`, JSON.stringify(ticketStatus));

                // Показываем уведомление
                notificationService.showTicketCalledNotification(data.data);

                // Воспроизводим аудио
                if (data.data.audio_url) {
                    const audio = new Audio(data.data.audio_url);
                    audio.play().catch(error => {
                        console.error("Error playing audio:", error);
                    });
                }

                notificationService.clearUserTicketInfo();
            }
        }

        if (data.type === "ticket_count_update" && data.data) {
            updateQueuePosition();
        }
    };

    ws.onopen = () => {
        console.log('WebSocket connected for ticket tracking');
        updateQueuePosition();
    };

    setSocket(ws);

    return () => {
        ws.close();
    };
}, [ticketId, ticketNumber, fullName, queueType, token]);

    const getQueueDisplayName = (type) => {
        const queueNames = {
            'BACHELOR': 'Бакалавр',
            'MASTER': 'Маг./Докт.',
            'PHD': 'PLATONUS'
        };
        return queueNames[type] || type;
    };

    const getManagerLocation = (managerUsername) => {
        if (!managerUsername) return 'менеджеру';
        
        const username = managerUsername.toLowerCase();
        
        if (username.includes('auditoria111') || username.includes('aauditoria111')) {
            return 'аудитории 111';
        } else if (username.includes('auditoria303')) {
            return 'аудитории 303';
        } else if (username.includes('auditoria305')) {
            return 'аудитории 305';
        } else if (username.includes('auditoria306')) {
            return 'аудитории 306';
        } else {
            const stolNumber = username.charAt(username.length - 1);
            return `столу ${stolNumber}`;
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

    return (
        <div className="ticket-display-container">
            <img src={logo} alt="Logo" className="logo" />
            
            <div className="ticket-header">
                <h1>ВАШ ТАЛОН</h1>
                {queueStatus === 'called' && (
                    <div className="called-notification">
                        🔔 ВАШ ТАЛОН ВЫЗВАН!
                    </div>
                )}
            </div>

            <div className="ticket-info">
                <div className="ticket-main-info">
                    <p><strong>ФИО:</strong> {fullName}</p>
                    <p><strong>НОМЕР ТАЛОНА:</strong> {ticketNumber}</p>
                    <p><strong>ТИП ОЧЕРЕДИ:</strong> {getQueueDisplayName(queueType)}</p>
                </div>

                {token && (
                    <div className="ticket-token">
                        <p><strong>Токен:</strong> {token}</p>
                        <small>Сохраните этот токен для отслеживания статуса</small>
                    </div>
                )}
            </div>

            <div className="queue-status">
                {queueStatus === 'waiting' && (
                    <div className="status-waiting">
                        <h3>Ожидание в очереди</h3>
                        {queuePosition && (
                            <div className="position-info">
                                <p>Ваша позиция в очереди: <strong>{queuePosition}</strong></p>
                                {estimatedWaitTime && (
                                    <p>Примерное время ожидания: <strong>{formatWaitTime(estimatedWaitTime)}</strong></p>
                                )}
                            </div>
                        )}
                        <div className="waiting-message">
                            <p>Ожидайте вызова. Ваше ФИО будет объявлено, когда подойдет ваша очередь.</p>
                            <div className="status-indicator">
                                <div className="spinner"></div>
                                <span>Ожидание...</span>
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
                        <p>Спасибо за использование электронной очереди!</p>
                    </div>
                )}
            </div>

            <div className="ticket-actions">
                <button 
                    className="refresh-button"
                    onClick={updateQueuePosition}
                >
                    Обновить статус
                </button>
                
                <button 
                    className="home-button"
                    onClick={() => window.location.href = '/'}
                >
                    На главную
                </button>
            </div>

            <div className="ticket-footer">
                <p className="footer-text">
                    Сохраните эту страницу или сделайте скриншот для отслеживания статуса
                </p>
                <p className="footer-warning">
                    Не покидайте здание до завершения обслуживания
                </p>
            </div>
        </div>
    );
}

export default TicketDisplayPage;