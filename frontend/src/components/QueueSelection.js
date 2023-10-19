import React from 'react';
import axios from 'axios';

function QueueSelection() {
    const handleQueueSelection = (queueType) => {
        axios.post('http://localhost:8000/join-queue/', {
            type: queueType
        })
        .then(response => {
            // Redirect to HomePage with the ticket number
            window.location.href = `/home?ticket=${response.data.ticket}`;
        })
        .catch(error => {
            console.error("Error joining queue:", error);
        });
    };

    return (
        <div>
            <h1>Select a Queue</h1>
            <button onClick={() => handleQueueSelection('BACHELOR')}>Join Bachelors Queue</button>
            <button onClick={() => handleQueueSelection('MASTER')}>Join Masters Queue</button>
            <button onClick={() => handleQueueSelection('PHD')}>Join PhD Queue</button>
        </div>
    );
}

export default QueueSelection;
