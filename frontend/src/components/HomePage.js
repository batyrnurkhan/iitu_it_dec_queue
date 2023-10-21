import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/homePage.css';

function HomePage() {
    const [queues, setQueues] = useState([]);

    useEffect(() => {
        // Fetch the current state of all queues
        axios.get('http://localhost:8000/queue/queues/')
            .then(response => {
                setQueues(response.data);
            })
            .catch(error => {
                console.error("Error fetching queue data:", error);
            });
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