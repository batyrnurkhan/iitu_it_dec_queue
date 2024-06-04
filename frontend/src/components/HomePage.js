import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import logo from '../static/logo.png';

function HomePage() {
    const [queues, setQueues] = useState([]);
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioAllowed, setAudioAllowed] = useState(true);
    const fetchQueues = () => {
        axios.get('http://10.8.1.53:8001/queue/queues/')
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
        const queuesSocketUrl = 'ws://10.8.1.53:8001/ws/queues/';
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
                            }
                            else if (queue['Все обслуживаемые талоны']) {
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

                    if (data.data.audio_url) {
                        setAudioQueue(prevQueue => [...prevQueue, data.data.audio_url]);
                    }
                }
                else if (data.message && data.message.includes("New ticket")) {
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
    // Only attempt to play audio if audio is allowed, not currently playing, and there's something in the queue
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

    return (

        <div className="wrapper">
            <img src={logo} alt="Logo" className="logo" />
            <div className="qr-card">
                <h2>Сканируй QR чтобы встать в очередь</h2>
                <p>--__--</p>
                <div className="qr-image-container">
                    <img src="http://10.8.1.53:8001/queue/generate-qr/" alt="QR Code for joining queue" />
                </div>
            </div>

            <div className="called-tickets-container">
                <h2>Все обслуживаемые талоны</h2>
                <div className="called-ticket-list">
                    {queues.flatMap(queue => (
                        Array.isArray(queue["Все обслуживаемые талоны"])
                            ? queue["Все обслуживаемые талоны"].map(ticket => (
                                <div className="called-ticket" key={ticket.ticket_number}>
                                    <div className="arrow-container">
                                        <p className="list_text_style">{ticket.ticket_number}</p>
                                    </div>
                                    <p>{ticket.manager_username || "Manager info not available"}</p>
                                </div>
                            ))
                            : []
                    ))}
                </div>
            </div>

            <div className="queue-container">
                <h2>Ожидающие</h2>
                <div className="ticket-list">
                    {
                        (() => {
                            let ticketCount = 0; // Variable to keep track of the total number of tickets displayed
                            const tickets = [];

                            queues.flatMap(queue => (
                                Array.isArray(queue["Зарегестрированные талоны"]) &&
                                queue["Зарегестрированные талоны"].forEach(ticket => {
                                    if (ticketCount < 12) { // Check if the limit is reached
                                        tickets.push(
                                            <div className="ticket" key={ticket}>
                                                <p className="list_text_style">{ticket}</p>
                                            </div>
                                        );
                                        ticketCount++; // Increment the counter
                                    }
                                })
                            ));

                            return tickets; // Return the array of ticket components
                        })()
                    }
                </div>
            </div>
            {!audioAllowed && (
                <button onClick={enableAudio}>Enable Sound Notifications</button>
            )}
        </div>
    );
}

export default HomePage;
