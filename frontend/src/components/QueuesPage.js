import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import '../styles/homePage.css';
import { config } from "../config";

function QueuesPage() {
    const [queues, setQueues] = useState([]);
    const [servingTickets, setServingTickets] = useState([]);
    const [socket, setSocket] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    console.log('Queues:', queues);
    console.log('Serving tickets:', servingTickets);

    const fetchQueues = () => {
        axios.get(config.fetchQueuesUrl, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
        .then(response => {
            console.log('Fetched data:', response.data);

            // Разделяем данные на очереди и обслуживаемые талоны
            const queueData = response.data.filter(item => item['Очередь']);
            const servingData = response.data.find(item => item['Все обслуживаемые талоны']);

            setQueues(queueData);
            setServingTickets(servingData ? servingData['Все обслуживаемые талоны'] : []);
            setLastUpdate(new Date());
        })
        .catch(error => console.error("Error fetching queues:", error));
    };

    useEffect(() => {
        fetchQueues();

        // Устанавливаем WebSocket соединение
        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);

            // Обновляем данные при получении уведомлений
            if (data.type === "ticket_count_update" ||
                data.type === "ticket_called" ||
                data.type === "new_ticket") {
                fetchQueues(); // Перезагружаем данные
            }
        };

        ws.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        setSocket(ws);

        // Автообновление каждые 30 секунд
        const interval = setInterval(fetchQueues, 30000);

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, []);

    const getQueueDisplayName = (queueType) => {
        const queueNames = {
            'BACHELOR': 'Бакалавр',
            'MASTER': 'Маг./Докт.',
            'PHD': 'PLATONUS'
        };
        return queueNames[queueType] || queueType;
    };

    const getManagerLocation = (managerUsername) => {
        if (!managerUsername) return 'столу';

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

    return (
        <div className="main">
            <div className="update-info">
                <p className="last-update">
                    Последнее обновление: {lastUpdate.toLocaleTimeString()}
                </p>
            </div>

            <div className="in_process">
                <h1 className="text_in">В процессе</h1>
                {servingTickets.length > 0 ? (
                    servingTickets.map((serving, index) => (
                        <div key={index} className="green_box">
                            <div className="serving-ticket-info">
                                <p className="list_text_style">
                                    <strong>{serving.full_name}</strong>
                                </p>
                                <p className="ticket-details">
                                    Талон №{serving.ticket_number} к {getManagerLocation(serving.manager_username)}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-message">
                        <p>Сейчас никто не обслуживается</p>
                    </div>
                )}
            </div>

            <div className="in_queue">
                <div className="line1"></div>
                <div className="line2"></div>
                <h1 className="text_in">Ожидающие</h1>

                {queues.map(queue => (
                    <div key={queue.Очередь} className="queue-section">
                        <h2 className="queue-title">
                            {getQueueDisplayName(queue.Очередь)}
                        </h2>

                        <div className="queue-tickets">
                            {Array.isArray(queue["Зарегестрированные талоны"]) &&
                             queue["Зарегестрированные талоны"].length > 0 ? (
                                queue["Зарегестрированные талоны"].map((ticket, index) => (
                                    <div className="gray_box_l" key={`${ticket.number}-${index}`}>
                                        <div className="ticket-info">
                                            <p className="ticket-name">{ticket.full_name}</p>
                                            <p className="ticket-number">№{ticket.number}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-queue">
                                    <p>Очередь пуста</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="queue-stats">
                <h3>Статистика очередей</h3>
                {queues.map(queue => (
                    <div key={`stats-${queue.Очередь}`} className="queue-stat">
                        <span className="stat-label">
                            {getQueueDisplayName(queue.Очередь)}:
                        </span>
                        <span className="stat-value">
                            {Array.isArray(queue["Зарегестрированные талоны"])
                                ? queue["Зарегестрированные талоны"].length
                                : 0} чел.
                        </span>
                    </div>
                ))}
            </div>

            <div className="qr">
                <img src={config.generateQrUrl} alt="QR Code for joining queue" />
                <p className="qr-description">
                    Отсканируйте QR-код для получения талона
                </p>
            </div>
        </div>
    );
}

export default QueuesPage;