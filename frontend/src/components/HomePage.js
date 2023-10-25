import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';

function HomePage() {
    const [queues, setQueues] = useState([]);

    useEffect(() => {
        axios.get('http://localhost:8000/queue/queues/')
            .then(response => {
                setQueues(response.data);
            })
            .catch(error => {
                console.error("Error fetching queue data:", error);
            });

        const wsUrl = 'ws://localhost:8000/ws/queues/';
        const socket = new ReconnectingWebSocket(wsUrl);

        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (Array.isArray(data)) {
                setQueues(data);
            } else if (data.message && data.message.includes("New ticket")) {
                // For simplicity, we're fetching the queues again after receiving such a message.
                // This guarantees our local state is always in sync with the server.
                axios.get('http://localhost:8000/queue/queues/')
                    .then(response => {
                        setQueues(response.data);
                    })
                    .catch(error => {
                        console.error("Error fetching queue data after WebSocket message:", error);
                    });
            }
        });

        return () => {
            socket.close();
        };
    }, []);

    return (
        <div>
            <h1>Current Queues</h1>
            {queues.map(queue => (
                <div key={queue.type}>
                    <h2>{queue.type} Queue</h2>
                    <p>Current Number: {queue["\"Сейчас обслуживается талон\""]}</p>
                    <p>Ticket Numbers: {queue["Зарегестрированные талоны"].join(', ')}</p>
                </div>
            ))}
        </div>
    );
}

export default HomePage;
