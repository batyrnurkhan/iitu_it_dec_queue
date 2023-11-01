import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import logo from '../static/logo.png';
function HomePage() {
    const [queues, setQueues] = useState([]);

    const fetchQueues = () => {
        axios.get('http://localhost:8000/queue/queues/')
            .then(response => {
                setQueues(response.data);
            })
            .catch(error => {
                console.error("Error fetching queue data:", error);
            });
    };

    useEffect(() => {
        fetchQueues();
        const queuesSocketUrl = 'ws://localhost:8000/ws/queues/';
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


    return (

        <div className="wrapper">
            <img src={logo} alt="Logo" className="logo" />
            <div className="qr-card">
                <h2>Сканируй QR чтобы встать в очередь</h2>
                <p>--__--</p>
                <div className="qr-image-container">
                    <img src="http://localhost:8000/queue/generate-qr/" alt="QR Code for joining queue" />
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
                    {queues.flatMap(queue => (
                        Array.isArray(queue["Зарегестрированные талоны"])
                            ? queue["Зарегестрированные талоны"].slice(0, 6).map(ticket => ( /* Only take the first 12 tickets */
                                <div className="ticket" key={ticket}>
                                    <p className="list_text_style">{ticket}</p>
                                </div>
                            ))
                            : []
                    ))}
                </div>
            </div>
        </div>
    );
}

export default HomePage;
