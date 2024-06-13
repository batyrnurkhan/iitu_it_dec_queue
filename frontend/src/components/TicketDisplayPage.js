import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReconnectingWebSocket from 'reconnecting-websocket';
import '../styles/TicketDisplayPage.css';
import logo from "../static/logo.png";
import { config } from "../config";

function TicketDisplayPage() {
    document.title = "TICKET"

    const location = useLocation();
    const { ticketNumber, queueType } = location.state || {};
    const [audioUrl, setAudioUrl] = useState('');
    const [managerUsername, setManagerUsername] = useState('');
    const [isTicketCalled, setIsTicketCalled] = useState(false);

    const translateManagerUsername = (username) => {
        const regex = /^stol(\d+)$/i;
        const match = username.match(regex);
        if (match) {
            return `СТОЛ ${match[1]}`;
        }
        return username;
    };

    useEffect(() => {
        const savedTicketCalled = localStorage.getItem('isTicketCalled') === 'true';
        const savedManagerUsername = localStorage.getItem('managerUsername');
        setIsTicketCalled(savedTicketCalled);
        if (savedManagerUsername) {
            setManagerUsername(savedManagerUsername);
        }
    }, []);

    useEffect(() => {
        const rws = new ReconnectingWebSocket(config.queuesSocketUrl);

        rws.onopen = () => {
            console.log('WebSocket connection established');
        };

        rws.onmessage = (message) => {
            const data = JSON.parse(message.data);
            if (data.type === 'ticket_called' && data.data.ticket_number === ticketNumber) {
                setAudioUrl(data.data.audio_url);
                const translatedUsername = translateManagerUsername(data.data.manager_username);
                setManagerUsername(translatedUsername);
                setIsTicketCalled(true);
                localStorage.setItem('isTicketCalled', 'true');
                localStorage.setItem('managerUsername', translatedUsername);
                const audio = new Audio(data.data.audio_url);
                audio.play();
            }
        };

        rws.onerror = (errorEvent) => {
            console.error("WebSocket error observed:", errorEvent);
            if (errorEvent.type === 'error') {
                window.location.href = '/error'; // Redirect to error page on WebSocket error
            }
        };

        rws.onclose = (closeEvent) => {
            console.warn("WebSocket connection closed:", closeEvent);
        };

        return () => {
            rws.close();
        };
    }, [ticketNumber]);

    return (
        <div>
            {isTicketCalled ? (
                <div className="ticket-display-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <h1>ПОДОЙДИТЕ К МЕНЕДЖЕРУ</h1>
                    <p><strong>МЕНЕДЖЕР:</strong> {managerUsername}</p>
                </div>
            ) : (
                <div className="ticket-display-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <h1>ВАШ ТАЛОН</h1>
                    <p><strong>ТИП ОЧЕРЕДИ:</strong> {queueType}</p>
                    <p><strong>НОМЕР ТАЛОНА:</strong> {ticketNumber}</p>
                </div>
            )}
        </div>
    );
}

export default TicketDisplayPage;
