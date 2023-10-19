import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ManagerWorkplace() {
    const [currentServing, setCurrentServing] = useState({ bachelors: 0, masters: 0, phd: 0 });

    useEffect(() => {
        // Fetch the current serving numbers when the component mounts
        const fetchCurrentServing = async () => {
            try {
                const response = await axios.get('http://localhost:8000/current-serving/');
                setCurrentServing(response.data);
            } catch (error) {
                console.error("Error fetching current serving numbers:", error);
            }
        };

        fetchCurrentServing();
    }, []);

    const handleNextTicket = async (queueType) => {
        try {
            const response = await axios.post('http://localhost:8000/call-next/', { type: queueType });
            // Update the current serving number for the specific queue type
            setCurrentServing(prevState => ({ ...prevState, [queueType]: response.data.ticket }));
        } catch (error) {
            console.error("Error calling the next ticket:", error);
        }
    };

    return (
        <div>
            <h1>Manager Workplace</h1>
            <div>
                <h3>Bachelors: Currently Serving {currentServing.bachelors}</h3>
                <button onClick={() => handleNextTicket('bachelors')}>Next Bachelor Ticket</button>
            </div>
            <div>
                <h3>Masters: Currently Serving {currentServing.masters}</h3>
                <button onClick={() => handleNextTicket('masters')}>Next Master Ticket</button>
            </div>
            <div>
                <h3>PhD: Currently Serving {currentServing.phd}</h3>
                <button onClick={() => handleNextTicket('phd')}>Next PhD Ticket</button>
            </div>
        </div>
    );
}

export default ManagerWorkplace;
