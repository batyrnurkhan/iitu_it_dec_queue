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
        navigate('/ticket', { state: { ticketNumber: response.data.ticket, queueType: queueType } });
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
