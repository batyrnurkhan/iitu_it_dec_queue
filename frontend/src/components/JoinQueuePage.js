import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
function JoinQueuePage() {
    const navigate = useNavigate();

    const handleJoin = (queueType) => {
        axios.post('http://localhost:8000/queue/join-queue/', { type: queueType }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                // TODO: Emit a WebSocket message here if not done on the server-side.
                // Redirect to home page after joining a queue
                navigate('/');
            })
            .catch(error => console.error("Error joining queue:", error));
    };

    return (
        <div className="join-queue-container">
            <button className="join-queue-button" onClick={() => handleJoin('BACHELOR')}>Join Bachelor Queue</button>
            <button className="join-queue-button" onClick={() => handleJoin('MASTER')}>Join Master Queue</button>
            <button className="join-queue-button" onClick={() => handleJoin('PHD')}>Join PhD Queue</button>
        </div>
    );
}

export default JoinQueuePage;
