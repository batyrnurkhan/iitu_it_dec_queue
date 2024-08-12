import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
import { config } from "../config";
import logo from "../static/logo.png";
import axiosInstance from "../axiosInstance";

function JoinQueuePage() {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');

    const handleJoin = (queueType) => {
        axiosInstance.post(config.joinQueueUrl, { type: queueType }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.data.message === "НЕ РАБОЧЕЕ ВРЕМЯ") {
                setMessage(response.data.message);
            } else {
                console.log("Response data:", response.data); // Log the response data to debug
                navigate('/ticket', { state: { ticketNumber: response.data.ticket, queueType: queueType, ticketId: response.data['ticket.id'] } });
            }
        })
        .catch(error => {
            console.error("Error joining queue:", error.response ? error.response.data : error);
        });
    };

    return (
        <div className="join-queue-container">
            <img src={logo} alt="Logo" className="logo" />
            {message ? (
                <p className="message">{message}</p>
            ) : (
                <>
                    <button className="join-queue-button" onClick={() => handleJoin('BACHELOR')}>Очередь на Бакалавр</button>
                    <button className="join-queue-button" onClick={() => handleJoin('MASTER')}>Очередь на Маг./Докт.</button>
                    <button className="join-queue-button" onClick={() => handleJoin('PHD')}>Очередь на PLATONUS</button>
                </>
            )}
        </div>
    );
}

export default JoinQueuePage;
