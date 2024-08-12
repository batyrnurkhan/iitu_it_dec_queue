import React from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/TicketDisplayPage.css';
import logo from "../static/logo.png";

function TicketDisplayPage() {
    document.title = "TICKET";

    const location = useLocation();
    const { ticketNumber, queueType } = location.state || {};

    return (
        <div className="ticket-display-container">
            <img src={logo} alt="Logo" className="logo" />
            <h1>ВАШ ТАЛОН</h1>
            <p><strong>ТИП ОЧЕРЕДИ:</strong> {queueType}</p>
            <p><strong>НОМЕР ТАЛОНА:</strong> {ticketNumber}</p>
        </div>
    );
}

export default TicketDisplayPage;
