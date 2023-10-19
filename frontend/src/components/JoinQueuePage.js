import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function JoinQueuePage() {
    const navigate = useNavigate();

    const handleJoin = (queueType) => {
        axios.post('http://localhost:8000/queue/join-queue/', { type: queueType }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`

            }
        })
        .then(response => {
            // Redirect to home page after joining a queue
            navigate('/');
        })
        .catch(error => console.error("Error joining queue:", error));
    };

    return (
        <div>
            <button onClick={() => handleJoin('BACHELOR')}>Join Bachelor Queue</button>
            <button onClick={() => handleJoin('MASTER')}>Join Master Queue</button>
            <button onClick={() => handleJoin('PHD')}>Join PhD Queue</button>
        </div>
    );
}

export default JoinQueuePage;