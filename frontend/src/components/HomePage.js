import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';

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
        fetchQueues();  // Initial fetch

        // Setting up WebSocket for queues
        const queuesSocketUrl = 'ws://localhost:8000/ws/queues/';
        const queuesSocket = new ReconnectingWebSocket(queuesSocketUrl);

        queuesSocket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            console.log("Received WebSocket message:", data);
            if (Array.isArray(data)) {
                setQueues(data);
            } else if (data.message && data.message.includes("New ticket")) {
                fetchQueues();
            } else if (data.type === 'ticket_called') {
                // Extracting ticket number and queue type from the message
                const messageParts = data.message.split(" ");
                const ticketNumber = parseInt(messageParts[1], 10);  // Ticket number should be at index 1
                const queueType = messageParts[messageParts.length - 2];  // Queue type should be the second last part

                setQueues(prevQueues => {
                    const updatedQueues = [...prevQueues];
                    const targetQueue = updatedQueues.find(q => q['Очередь'] === queueType);
                    if (targetQueue) {
                        targetQueue['Зарегестрированные талоны'] = targetQueue['Зарегестрированные талоны'].filter(ticket => ticket !== ticketNumber);
                        targetQueue['Сейчас обслуживается талон'] = ticketNumber;  // Set the called ticket as the current number
                    }
                    return updatedQueues;
                });
            }
        });


        // Setting up WebSocket for call-next
        // Note: Depending on your design, you might not need this anymore since the above handler is taking care of ticket calls as well
        const callNextSocketUrl = 'ws://localhost:8000/ws/call-next/';
        const callNextSocket = new ReconnectingWebSocket(callNextSocketUrl);

        callNextSocket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.action && data.action === "call_next") {
                fetchQueues();  // You might want to re-evaluate the need for this fetch based on the above updates
            }
        });

        return () => {
            queuesSocket.close();
            callNextSocket.close();
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
