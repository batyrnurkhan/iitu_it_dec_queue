import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
import { config } from "../config";
import logo from "../static/logo.png";
import axiosInstance from "../axiosInstance";

function JoinQueuePage() {
    const navigate = useNavigate();

    const handleJoin = (queueType) => {
        axiosInstance.post(config.joinQueueUrl, { type: queueType }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            navigate('/ticket', { state: { ticketNumber: response.data.ticket, queueType: queueType } });
        })
        .catch(error => console.error("Error joining queue:", error.response ? error.response.data : error));
    };

    const handleTouch = (queueType) => {
        handleJoin(queueType);
    };

    return (
        <div className="join-queue-container">
            <img src={logo} alt="Logo" className="logo" />
            <button className="join-queue-button" onClick={() => handleJoin('BACHELOR')} onTouchEnd={() => handleTouch('BACHELOR')}>Очередь для бакалавров</button>
            <button className="join-queue-button" onClick={() => handleJoin('MASTER')} onTouchEnd={() => handleTouch('MASTER')}>Очередь для магистратуры</button>
            <button className="join-queue-button" onClick={() => handleJoin('PHD')} onTouchEnd={() => handleTouch('PHD')}>Очередь для доктарантуры</button>
        </div>
    );
}

export default JoinQueuePage;
