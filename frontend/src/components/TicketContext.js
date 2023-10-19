import React, { createContext, useState, useContext } from 'react';

const TicketContext = createContext();

export const TicketProvider = ({ children }) => {
    const [currentTicket, setCurrentTicket] = useState(null);
    const [registeredTickets, setRegisteredTickets] = useState([]);

    return (
        <TicketContext.Provider value={{ currentTicket, setCurrentTicket, registeredTickets, setRegisteredTickets }}>
            {children}
        </TicketContext.Provider>
    );
}

export const useTicketContext = () => {
    return useContext(TicketContext);
};
