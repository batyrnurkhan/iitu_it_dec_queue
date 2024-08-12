import React, { useState, useEffect } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';
import logo from '../static/logo.png';
import { config } from "../config";
import axiosInstance from "../axiosInstance";

function HomePage() {
    document.title = "QR CODE";
    const [queues, setQueues] = useState([]);
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioAllowed, setAudioAllowed] = useState(true);
    const [ticketDisplayQueue, setTicketDisplayQueue] = useState([]);
    const [currentTicket, setCurrentTicket] = useState(null);

    const fetchQueues = () => {
        axiosInstance.get(config.fetchQueuesUrl)
            .then(response => {
                setQueues(response.data);
            })
            .catch(error => {
                console.error("Error fetching queue data:", error);
            });
    };

    const enableAudio = () => {
        setAudioAllowed(true);
    };

    useEffect(() => {
        fetchQueues();
        const queuesSocketUrl = config.queuesSocketUrl;
        const queuesSocket = new ReconnectingWebSocket(queuesSocketUrl);

        queuesSocket.onerror = (errorEvent) => {
            console.error("WebSocket error observed:", errorEvent);
        };

        queuesSocket.onmessage = (event) => {
            console.log("WebSocket message received:", event.data);
            try {
                const data = JSON.parse(event.data);
                console.log("Parsed data:", data);

                if (data.type === 'ticket_called' && data.data && data.data.queue_type) {
                    setQueues(prevQueues => {
                        return prevQueues.map(queue => {
                            if (queue['Очередь'] === data.data.queue_type) {
                                const updatedRegisteredTickets = queue['Зарегестрированные талоны'].filter(ticket =>
                                    String(ticket) !== String(data.data.ticket_number)
                                );
                                return {
                                    ...queue,
                                    'Зарегестрированные талоны': updatedRegisteredTickets,
                                };
                            } else if (queue['Все обслуживаемые талоны']) {
                                const updatedServedTickets = queue['Все обслуживаемые талоны'].filter(ticket =>
                                    ticket.manager_username !== data.data.manager_username
                                );
                                updatedServedTickets.push({
                                    ticket_number: data.data.ticket_number,
                                    manager_username: data.data.manager_username
                                });
                                return {
                                    ...queue,
                                    'Все обслуживаемые талоны': updatedServedTickets
                                };
                            }
                            return queue;
                        });
                    });

                    setTicketDisplayQueue(prevQueue => [...prevQueue, {
                        ticket_number: data.data.ticket_number,
                        manager_username: data.data.manager_username
                    }]);

                    if (data.data.audio_url) {
                        setAudioQueue(prevQueue => [...prevQueue, data.data.audio_url]);
                    }
                } else if (data.message && data.message.includes("New ticket")) {
                    fetchQueues();
                }
            } catch (error) {
                console.error("Error handling WebSocket message:", error);
            }
        };
        return () => {
            queuesSocket.close();
        };
    }, []);

    useEffect(() => {
        if (audioAllowed && !isPlaying && audioQueue.length > 0) {
            setIsPlaying(true);
            const audio = new Audio(audioQueue[0]);
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Playback started successfully
                }).catch(error => {
                    console.error("Error playing the audio:", error);
                });

                audio.onended = () => {
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                    setIsPlaying(false);
                };
            }
        }
    }, [audioQueue, isPlaying, audioAllowed]);

    useEffect(() => {
        if (ticketDisplayQueue.length > 0 && currentTicket === null) {
            setCurrentTicket(ticketDisplayQueue[0]);
            setTicketDisplayQueue(prevQueue => prevQueue.slice(1));
        }
    }, [ticketDisplayQueue, currentTicket]);

    useEffect(() => {
        if (currentTicket !== null) {
            const timer = setTimeout(() => {
                setCurrentTicket(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [currentTicket]);

const getFormattedManagerName = (username) => {
        const auditoriaMatch = username.match(/^(a?auditoria)(\d+)$/i);
        if (auditoriaMatch) {
            return `АУД. ${auditoriaMatch[2]}`;
        }
        const stolMatch = username.match(/^stol(\d+)$/);
        return stolMatch ? `СТОЛ ${stolMatch[1]}` : username;
    };


    return (
        <div className="wrapper">
            <img src={logo} alt="Logo" className="logo" />
            <div className="qr-card">
                <h2>Сканируй QR чтобы встать в очередь</h2>
                <p>--__--</p>
                <div className="qr-image-container">
 <img src="https://queue.iitu.edu.kz/api/v2/queue/generate-qr/" alt="QR Code for joining queue" />
                </div>
            </div>

            <div className="called-tickets-container">
                <h2>Все обслуживаемые талоны</h2>
                <div className="called-ticket-list">
                    {queues.flatMap(queue => (
                        Array.isArray(queue["Все обслуживаемые талоны"])
                            ? queue["Все обслуживаемые талоны"].map(ticket => (
                                <div className="called-ticket" key={ticket.ticket_number}>
                                    <p className="list_text_style">{ticket.ticket_number} </p> | <p>   </p>
                                    <p> {getFormattedManagerName(ticket.manager_username) || "Manager info not available"}</p>
                                </div>
                            ))
                            : []
                    ))}
                </div>
            </div>

            <div className="current-ticket-display">
                {currentTicket && (
                    <div className="called-ticket">
                        <p className="list_text_style">{currentTicket.ticket_number} | </p>
                        <p>{getFormattedManagerName(currentTicket.manager_username)}</p>
                    </div>
                )}
            </div>

            {!audioAllowed && (
                <button onClick={enableAudio}>Enable Sound Notifications</button>
            )}
        </div>
    );
}

export default HomePage;
