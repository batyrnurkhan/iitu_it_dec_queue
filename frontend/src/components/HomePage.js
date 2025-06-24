import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import logo from '../static/logo.png';
import { config } from "../config";
import axiosInstance from "../axiosInstance";
import '../styles/homePage.css';

function HomePage() {
    document.title = "Электронная очередь - IITU";

    // State management
    const [queues, setQueues] = useState([]);
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioAllowed, setAudioAllowed] = useState(false);
    const [ticketDisplayQueue, setTicketDisplayQueue] = useState([]);
    const [currentTicket, setCurrentTicket] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    // Memoized values
    const servedTickets = useMemo(() => {
        return queues.flatMap(queue => (
            Array.isArray(queue["Все обслуживаемые талоны"])
                ? queue["Все обслуживаемые талоны"]
                : []
        ));
    }, [queues]);

    // Fetch queues function
    const fetchQueues = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axiosInstance.get(config.fetchQueuesUrl);
            setQueues(response.data);
            setConnectionStatus('connected');
        } catch (error) {
            console.error("Error fetching queue data:", error);
            setError("Ошибка загрузки данных очереди");
            setConnectionStatus('error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Enable audio function
    const enableAudio = useCallback(() => {
        setAudioAllowed(true);
        // Haptic feedback на мобильных
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Сохраняем предпочтение пользователя
        localStorage.setItem('audioAllowed', 'true');
    }, []);

    // Получение форматированного имени менеджера
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

    // Handle WebSocket message
    const handleWebSocketMessage = useCallback((data) => {
    console.log('WebSocket message received:', data);

    if (data.type === 'ticket_called' && data.data && data.data.queue_type) {
        console.log('Ticket called data:', data.data);

        // Обновляем очереди - ИСПРАВЛЕНО: ищем по queue_type_code
        setQueues(prevQueues => {
            return prevQueues.map(queue => {
                // Проверяем и по queue_type_code, и по queue_type_display
                const queueMatches =
                    queue['queue_type_code'] === data.data.queue_type ||
                    queue['Очередь'] === data.data.queue_type_display;

                if (queueMatches) {
                    console.log('Updating queue:', queue['Очередь']);
                    const updatedRegisteredTickets = queue['Зарегестрированные талоны'].filter(ticket =>
                        String(ticket.number || ticket) !== String(data.data.ticket_number)
                    );
                    return {
                        ...queue,
                        'Зарегестрированные талоны': updatedRegisteredTickets,
                    };
                } else if (queue['Все обслуживаемые талоны']) {
                    // Обновляем список обслуживаемых талонов
                    const updatedServedTickets = queue['Все обслуживаемые талоны'].filter(ticket =>
                        ticket.manager_username !== data.data.manager_username
                    );

                    // Добавляем новый обслуживаемый талон
                    updatedServedTickets.push({
                        ticket_number: data.data.ticket_number,
                        full_name: data.data.full_name,
                        manager_username: data.data.manager_username,
                        queue_type: data.data.queue_type,
                        queue_type_display: data.data.queue_type_display
                    });

                    console.log('Updated served tickets:', updatedServedTickets);

                    return {
                        ...queue,
                        'Все обслуживаемые талоны': updatedServedTickets
                    };
                }
                return queue;
            });
        });

        // Добавляем в очередь отображения - СОКРАЩАЕМ время показа
        setTicketDisplayQueue(prevQueue => [...prevQueue, {
            ticket_number: data.data.ticket_number,
            full_name: data.data.full_name,
            manager_username: data.data.manager_username,
            queue_type: data.data.queue_type,
            queue_type_display: data.data.queue_type_display
        }]);

        // Добавляем аудио в очередь
        if (data.data.audio_url) {
            setAudioQueue(prevQueue => [...prevQueue, data.data.audio_url]);
        }

        // Haptic feedback при вызове талона
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

    } else if (data.message && data.message.includes("New ticket")) {
        fetchQueues();
    } else if (data.type === "ticket_count_update") {
        fetchQueues();
    }
}, [fetchQueues]);

    // WebSocket setup
    useEffect(() => {
        // Проверяем сохраненные предпочтения пользователя
        const savedAudioPreference = localStorage.getItem('audioAllowed');
        if (savedAudioPreference === 'true') {
            setAudioAllowed(true);
        }

        fetchQueues();

        const queuesSocketUrl = config.queuesSocketUrl;
        const queuesSocket = new ReconnectingWebSocket(queuesSocketUrl);

        queuesSocket.onopen = () => {
            console.log("WebSocket connected");
            setConnectionStatus('connected');
        };

        queuesSocket.onerror = (errorEvent) => {
            console.error("WebSocket error observed:", errorEvent);
            setConnectionStatus('error');
        };

        queuesSocket.onclose = () => {
            setConnectionStatus('disconnected');
        };

        queuesSocket.onmessage = (event) => {
            console.log("WebSocket message received:", event.data);

            try {
                const data = JSON.parse(event.data);
                console.log("Parsed data:", data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error("Error handling WebSocket message:", error);
            }
        };

        return () => {
            queuesSocket.close();
        };
    }, [fetchQueues, handleWebSocketMessage]);

    // Audio queue processing
    useEffect(() => {
        if (audioAllowed && !isPlaying && audioQueue.length > 0) {
            setIsPlaying(true);
            const audio = new Audio(audioQueue[0]);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log("Audio started playing");
                }).catch(error => {
                    console.error("Error playing the audio:", error);
                    setIsPlaying(false);
                });

                audio.onended = () => {
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                    setIsPlaying(false);
                };

                audio.onerror = () => {
                    console.error("Audio playback error");
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                    setIsPlaying(false);
                };
            }
        }
    }, [audioQueue, isPlaying, audioAllowed]);

    // Ticket display processing
    useEffect(() => {
        if (ticketDisplayQueue.length > 0 && currentTicket === null) {
            setCurrentTicket(ticketDisplayQueue[0]);
            setTicketDisplayQueue(prevQueue => prevQueue.slice(1));
        }
    }, [ticketDisplayQueue, currentTicket]);

    // Hide current ticket timer
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
                        <div className="text-6xl mb-4">⏳</div>
                        <div className="text-xl text-white font-semibold">Загрузка...</div>
                        <div className="text-white/80 mt-2">Получение данных о талонах</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="homepage-container">
            {/* Логотип */}
            <img
                src={logo}
                alt="Логотип IITU"
                className="homepage-logo"
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

            <div className="homepage-grid">
                {/* QR код секция */}
                <div className="homepage-card qr-section">
                    <h2 className="card-title">
                        📱 Получить талон
                    </h2>
                    <p className="card-subtitle">
                        Отсканируйте QR-код для быстрого получения талона или нажмите кнопку ниже
                    </p>

                    <div className="qr-container">
                        <img
                            src={`${config.apiBaseUrl}/queue/generate-qr/`}
                            alt="QR код для получения талона"
                            className="qr-image"
                            onError={(e) => {
                                e.target.alt = "QR код недоступен";
                                e.target.style.opacity = 0.5;
                            }}
                        />
                    </div>

                    <Link to="/join-queue" className="join-queue-link">
                        ✨ Получить талон онлайн
                    </Link>
                </div>

                {/* Секция обслуживаемых талонов */}
                <div className="homepage-card tickets-section">
                    <div className="tickets-header">
                        <h2 className="card-title">
                            🎫 Обслуживаемые талоны
                        </h2>
                        <div className="ticket-counter">
                            {servedTickets.length} активных
                        </div>
                    </div>

                    {error ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">❌</div>
                            <div className="empty-state-text">Ошибка загрузки</div>
                            <div className="empty-state-subtitle">{error}</div>
                            <button
                                onClick={fetchQueues}
                                className="btn btn-primary mt-4"
                            >
                                Повторить попытку
                            </button>
                        </div>
                    ) : servedTickets.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <div className="empty-state-text">Нет активных талонов</div>
                            <div className="empty-state-subtitle">Обслуживаемые талоны появятся здесь</div>
                        </div>
                    ) : (
                        <div className="tickets-list">
                            {servedTickets.map((ticket, index) => (
                                <div
                                    key={`${ticket.ticket_number}-${ticket.manager_username}-${index}`}
                                    className="ticket-item"
                                >
                                    <div className="ticket-info">
                                        <div className="ticket-number">
                                            №{ticket.ticket_number}
                                        </div>
                                        <div className="ticket-name">
                                            {ticket.full_name}
                                        </div>
                                    </div>
                                    <div className="manager-info">
                                        {getFormattedManagerName(ticket.manager_username)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Popup для отображения вызванного талона */}
            {currentTicket && (
                <div className="ticket-popup" role="alert" aria-live="assertive">
                    <div className="ticket-popup-content">
                        <div className="ticket-header">
                            <div className="ticket-number">
                                №{currentTicket.ticket_number}
                            </div>
                            <div className="manager-info">
                                {getFormattedManagerName(currentTicket.manager_username)}
                            </div>
                        </div>
                        <div className="ticket-name">
                        {currentTicket.full_name}
            </div>
        </div>
    </div>
)}

            {/* Кнопка включения звука */}
            {!audioAllowed && (
                <button
                    onClick={enableAudio}
                    className="audio-enable-btn"
                    aria-label="Включить звуковые уведомления"
                >
                    Включить звук
                </button>
            )}
        </div>
    );
}

export default HomePage;