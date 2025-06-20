import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import '../styles/TicketDisplayPage.css';
import { config } from "../config";
import logo from "../static/logo.png";
import notificationService from '../services/NotificationService';

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
            const response = await fetch(config.fetchQueuesUrl, {
                headers: {
                    'Authorization': `Token ${localStorage.getItem('access_token')}`
                }
            });
            const data = await response.json();

            // Находим нашу очередь
            const ourQueue = data.find(queue => queue['Очередь'] === queueType);
            if (ourQueue && ourQueue['Зарегестрированные талоны']) {
                const tickets = ourQueue['Зарегестрированные талоны'];
                const ourIndex = tickets.findIndex(ticket =>
                    ticket.number === ticketNumber || ticket.full_name === fullName
                );

                if (ourIndex !== -1) {
                    setQueuePosition(ourIndex + 1);
                    // Примерная оценка времени ожидания (2-3 минуты на человека)
                    setEstimatedWaitTime(ourIndex * 2.5);
                } else {
                    // Талон не найден в очереди, возможно уже обслужен
                    setQueueStatus('completed');
                }
            }
        } catch (error) {
            console.error("Error updating queue position:", error);
        }
    };

    useEffect(() => {
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

        // Устанавливаем WebSocket соединение для отслеживания статуса
        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message on ticket page:', data);

            if (data.type === "ticket_called" && data.data) {
                // Проверяем, вызвали ли наш талон
                if (data.data.ticket_id === ticketId ||
                    (data.data.ticket_number === ticketNumber && data.data.full_name === fullName)) {
                    setQueueStatus('called');
                    setCurrentlyServing({
                        full_name: data.data.full_name,
                        ticket_number: data.data.ticket_number,
                        manager_username: data.data.manager_username
                    });

                    // Показываем push-уведомление через наш сервис
                    notificationService.showTicketCalledNotification(data.data);

                    // Воспроизводим аудио если доступно
                    if (data.data.audio_url) {
                        const audio = new Audio(data.data.audio_url);
                        audio.play().catch(error => {
                            console.error("Error playing audio:", error);
                        });
                    }

                    // Очищаем информацию о талоне, так как он уже вызван
                    notificationService.clearUserTicketInfo();
                }
            }

            if (data.type === "ticket_count_update" && data.data) {
                // Обновляем позицию в очереди
                updateQueuePosition();
            }
        };

        ws.onopen = () => {
            console.log('WebSocket connected for ticket tracking');
            // Запрашиваем текущий статус очереди
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