import React from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/TicketDisplayPage.css';

function TicketDisplayPage() {
    const location = useLocation();
    const { ticketNumber, queueType } = location.state || {};

    return (
        <div className="ticket-display-container">
            <h1>Ticket Details</h1>
            <p><strong>Queue Type:</strong> {queueType}</p>
            <p><strong>Ticket Number:</strong> {ticketNumber}</p>
        </div>
    );
}

export default TicketDisplayPage;
