import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Profile() {
    const [userData, setUserData] = useState({});

    useEffect(() => {
        const token = localStorage.getItem('access_token');

        axios.get('http://localhost:8000/profile/', {
            headers: {
                'Authorization': `Token ${token}`
            }
        })
        .then((response) => {
            setUserData(response.data);
        })
        .catch((error) => {
            console.error("Error fetching profile data:", error);
        });
    }, []);

    const handleCallNext = () => {
        // Make an API request to the /call-next/ endpoint
        axios.post('http://localhost:8000/queue/call-next/', {
            type: userData.manager_type
        }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
        .then(response => {
            // Update the state with the newly called ticket
            setUserData(prevState => ({
                ...prevState,
                calledTicket: response.data.ticket
            }));
        })
        .catch(error => {
            console.error("Error calling the next ticket:", error);
        });
    };

    return (
        <div>
            <h2>Profile</h2>
            <p>Username: {userData.username}</p>
            <p>Email: {userData.email}</p>
            <p>Role: {userData.role}</p>
            <p>Manager Type: {userData.manager_type}</p>

            {/* Conditionally render manager-specific features */}
            {userData.role === "MANAGER" && (
                <div>
                    {userData.calledTicket ? (
                        <div>
                            <p>Last called ticket: {userData.calledTicket}</p>
                            <button onClick={handleCallNext}>Call Next</button>
                        </div>
                    ) : (
                        <button onClick={handleCallNext}>Call Next</button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Profile;
