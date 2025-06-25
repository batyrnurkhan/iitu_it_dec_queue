import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import logo from '../static/logo.png';
import { config } from "../config";
import axiosInstance from "../axiosInstance";
import '../styles/homePage.css'
function HomePage() {
    document.title = "Электронная очередь - IITU";

    // State
    const [queues, setQueues] = useState([]);
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioAllowed, setAudioAllowed] = useState(false);
    const [ticketDisplayQueue, setTicketDisplayQueue] = useState([]);
    const [currentTicket, setCurrentTicket] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    // Get served tickets
    const servedTickets = useMemo(() => {
        return queues.flatMap(queue => (
            Array.isArray(queue["Все обслуживаемые талоны"])
                ? queue["Все обслуживаемые талоны"]
                : []
        ));
    }, [queues]);

    // Fetch queues
    const fetchQueues = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axiosInstance.get(config.fetchQueuesUrl);
            setQueues(response.data);
            setConnectionStatus('connected');
        } catch (error) {
            console.error("Error fetching queues:", error);
            setError("Ошибка загрузки данных");
            setConnectionStatus('error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Enable audio
    const enableAudio = useCallback(() => {
        setAudioAllowed(true);
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        localStorage.setItem('audioAllowed', 'true');
    }, []);

    // Format manager name
    const getFormattedManagerName = useCallback((username) => {
        if (!username) return "Менеджер";

        const auditoriaMatch = username.match(/^(a?auditoria)(\d+)$/i);
        if (auditoriaMatch) {
            return `АУД. ${auditoriaMatch[2]}`;
        }

        const stolMatch = username.match(/^stol(\d+)$/i);
        if (stolMatch) {
            return `СТОЛ ${stolMatch[1]}`;
        }

        return username.toUpperCase();
    }, []);

    // Handle WebSocket messages
    const handleWebSocketMessage = useCallback((data) => {
        try {
            if (data.type === 'ticket_called' && data.data) {
                if (!data.data.queue_type || !data.data.ticket_number || !data.data.manager_username) {
                    return;
                }

                // Update queues
                setQueues(prevQueues => {
                    if (!Array.isArray(prevQueues)) return [];

                    return prevQueues.map(queue => {
                        if (!queue || typeof queue !== 'object') return queue;

                        // Remove from registered tickets
                        if (queue['queue_type_code'] === data.data.queue_type) {
                            const registeredTickets = Array.isArray(queue['Зарегестрированные талоны'])
                                ? queue['Зарегестрированные талоны']
                                : [];

                            const updatedRegisteredTickets = registeredTickets.filter(ticket =>
                                String(ticket?.number || '') !== String(data.data.ticket_number)
                            );

                            return {
                                ...queue,
                                'Зарегестрированные талоны': updatedRegisteredTickets,
                            };
                        }

                        // Update served tickets
                        if (queue['Все обслуживаемые талоны'] && Array.isArray(queue['Все обслуживаемые талоны'])) {
                            const servedTickets = [...queue['Все обслуживаемые талоны']];

                            // Remove previous ticket from this manager
                            const filteredTickets = servedTickets.filter(ticket =>
                                ticket?.manager_username !== data.data.manager_username
                            );

                            // Add new ticket
                            const newTicket = {
                                ticket_number: data.data.ticket_number || 'N/A',
                                full_name: data.data.full_name || 'Неизвестно',
                                manager_username: data.data.manager_username || 'Неизвестно',
                                queue_type: data.data.queue_type || 'UNKNOWN',
                                queue_type_display: data.data.queue_type_display || data.data.queue_type || 'Неизвестная очередь'
                            };

                            filteredTickets.push(newTicket);

                            return {
                                ...queue,
                                'Все обслуживаемые талоны': filteredTickets
                            };
                        }

                        return queue;
                    });
                });

                // Add to popup queue
                const popupTicket = {
                    ticket_number: data.data.ticket_number || 'N/A',
                    full_name: data.data.full_name || 'Неизвестно',
                    manager_username: data.data.manager_username || 'Неизвестно',
                    queue_type: data.data.queue_type || 'UNKNOWN',
                    queue_type_display: data.data.queue_type_display || data.data.queue_type || 'Неизвестная очередь'
                };

                setTicketDisplayQueue(prevQueue => [...prevQueue, popupTicket]);

                // Add audio
                if (data.data.audio_url) {
                    setAudioQueue(prevQueue => [...prevQueue, data.data.audio_url]);
                }

                // Vibration
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }

            } else if (data.message?.includes("New ticket") ||
                       data.type === "ticket_count_update" ||
                       data.type === "new_ticket") {
                fetchQueues();
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }, [fetchQueues]);

    // WebSocket setup
    useEffect(() => {
        // Check saved audio preference
        const savedAudioPreference = localStorage.getItem('audioAllowed');
        if (savedAudioPreference === 'true') {
            setAudioAllowed(true);
        }

        fetchQueues();

        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnectionStatus('connected');
        };

        ws.onerror = () => {
            setConnectionStatus('error');
        };

        ws.onclose = () => {
            setConnectionStatus('disconnected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        return () => ws.close();
    }, [fetchQueues, handleWebSocketMessage]);

    // Audio processing
    useEffect(() => {
        if (audioAllowed && !isPlaying && audioQueue.length > 0) {
            setIsPlaying(true);
            const audio = new Audio(audioQueue[0]);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Error playing audio:", error);
                    setIsPlaying(false);
                });

                audio.onended = () => {
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                    setIsPlaying(false);
                };

                audio.onerror = () => {
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                    setIsPlaying(false);
                };
            }
        }
    }, [audioQueue, isPlaying, audioAllowed]);

    // Ticket popup processing
    useEffect(() => {
        if (ticketDisplayQueue.length > 0 && currentTicket === null) {
            setCurrentTicket(ticketDisplayQueue[0]);
            setTicketDisplayQueue(prevQueue => prevQueue.slice(1));
        }
    }, [ticketDisplayQueue, currentTicket]);

    // Hide popup timer
    useEffect(() => {
        if (currentTicket !== null) {
            const timer = setTimeout(() => {
                setCurrentTicket(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [currentTicket]);

    // Loading state
    if (isLoading && queues.length === 0) {
        return (
            <div className="homepage-container">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="text-xl font-semibold mb-md">Загрузка...</div>
                        <div className="text-gray-600">Получение данных о талонах</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="homepage-container">
            {/* Logo */}
            <img
                src={logo}
                alt="Логотип IITU"
                className="homepage-logo"
                onError={(e) => e.target.style.display = 'none'}
            />

            {/* Connection status */}
            {connectionStatus !== 'connected' && (
                <div className={`connection-status ${connectionStatus}`}>
                    {connectionStatus === 'error' ? 'Ошибка подключения' :
                     connectionStatus === 'disconnected' ? 'Подключение потеряно' :
                     'Подключение...'}
                </div>
            )}

            <div className="homepage-grid">
                {/* QR Section */}
                <div className="qr-section">
                    <h2 className="qr-title">
                        📱 Получить талон
                    </h2>
                    <p className="qr-subtitle">
                        Отсканируйте QR-код для быстрого получения талона
                    </p>

                    <div className="qr-container">
                        <img
                            src={`${config.apiBaseUrl}/queue/generate-qr/`}
                            alt="QR код"
                            className="qr-image"
                            onError={(e) => e.target.style.opacity = 0.5}
                        />
                    </div>

                    <Link to="/join-queue" className="qr-button">
                        ✨ Получить талон
                    </Link>
                </div>

                {/* Tickets Section */}
                <div className="tickets-section">
                    <div className="tickets-header">
                        <h2 className="tickets-title">
                            🎫 Обслуживаемые талоны
                        </h2>
                        <div className="tickets-count">
                            {servedTickets.length}
                        </div>
                    </div>

                    {error ? (
                        <div className="empty-state">
                            <div className="empty-icon">❌</div>
                            <div className="empty-title">Ошибка загрузки</div>
                            <div className="empty-subtitle">{error}</div>
                            <button onClick={fetchQueues} className="btn btn-primary mt-md">
                                Повторить
                            </button>
                        </div>
                    ) : servedTickets.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <div className="empty-title">Нет активных талонов</div>
                            <div className="empty-subtitle">Талоны появятся здесь при вызове</div>
                        </div>
                    ) : (
                        <div className="tickets-list">
                            {servedTickets.map((ticket, index) => {
                                if (!ticket || typeof ticket !== 'object') return null;

                                const ticketNumber = ticket.ticket_number || 'N/A';
                                const fullName = ticket.full_name || 'Неизвестно';
                                const managerUsername = ticket.manager_username || 'unknown';
                                const queueTypeDisplay = ticket.queue_type_display || ticket.queue_type || 'Неизвестная очередь';

                                return (
                                    <div key={`${ticketNumber}-${managerUsername}-${index}`} className="ticket-item">
                                        <div className="ticket-info">
                                            <div className="ticket-number">№{ticketNumber}</div>
                                            <div className="ticket-name">{fullName}</div>
                                            <div className="ticket-queue-type">{queueTypeDisplay}</div>
                                        </div>
                                        <div className="manager-info">
                                            {getFormattedManagerName(managerUsername)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Popup */}
            {currentTicket && (
                <div className="ticket-popup">
                    <div className="popup-header">
                        <div className="popup-ticket-number">
                            №{currentTicket.ticket_number || 'N/A'}
                        </div>
                        <div className="popup-manager">
                            {getFormattedManagerName(currentTicket.manager_username || 'unknown')}
                        </div>
                    </div>
                    <div className="popup-name">
                        {currentTicket.full_name || 'Неизвестно'}
                    </div>
                    {(currentTicket.queue_type_display || currentTicket.queue_type) && (
                        <div className="popup-queue-type">
                            {currentTicket.queue_type_display || currentTicket.queue_type}
                        </div>
                    )}
                </div>
            )}

            {/* Audio Button */}
            {!audioAllowed && (
                <button onClick={enableAudio} className="audio-button">
                    🔊 Включить звук
                </button>
            )}
        </div>
    );
}

export default HomePage;