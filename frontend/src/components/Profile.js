import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/profile.css';
import ReconnectingWebSocket from 'reconnecting-websocket';

function Profile() {
    const [userData, setUserData] = useState({});
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const ws = new ReconnectingWebSocket('ws://localhost:8000/ws/call-next/');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received message:", data);
            if (data.action && data.action === "call_next" && data.ticket_number) {
                setUserData(prevState => ({
                    ...prevState,
                    calledTicket: data.ticket_number
                }));
            }
        };

        setSocket(ws); // <-- set the socket state

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

        return () => {
            ws.close();
        };
    }, []);

    const handleCallNext = () => {
        axios.post('http://localhost:8000/queue/call-next/', {
            type: userData["manager_type"]
        }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                setUserData(prevState => ({
                    ...prevState,
                    calledTicket: response.data["ticket_number"]
                }));
                socket && socket.send(JSON.stringify({ action: 'call_next', ticket_number: response.data["ticket"] }));

                if (response.data["audio_url"]) {
                    const audio = new Audio(response.data["audio_url"]);
                    audio.play();
                } else {
                    console.error("No audio_url found in the response.");
                }
            })
            .catch(error => {
                console.error("Error calling the next ticket:", error);
            });
    };

    const handleLogout = () => {
        axios.post('http://localhost:8000/logout/', {}, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                console.log("Logout successful:", response.data.message);
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            })
            .catch(error => {
                console.error("Error during logout:", error);
            });
    };

    return (
        <div className="profile-container">
            <div className="profile-header">
                <h1 className="profile-username">{userData.username}</h1>
                <p className="profile-user-description">Welcome to your profile</p>
            </div>

            <div className="profile-details">
                <div className="profile-detail">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value">{userData.role}</span>
                </div>
                <div className="profile-detail">
                    <span className="detail-label">Manager Type:</span>
                    <span className="detail-value">{userData["manager_type"]}</span>
                </div>
            </div>

            <div className="call-next">
                {userData.role === "MANAGER" && (
                    <div>
                        {userData.calledTicket ? (
                            <div>
                                <span className="detail-label">Last called ticket:</span>
                                <span className="detail-value last-called-ticket">{userData.calledTicket}</span>
                                <button className="call-next-button" onClick={handleCallNext}>Call Next</button>
                            </div>
                        ) : (
                            <button className="call-next-button" onClick={handleCallNext}>Call Next</button>
                        )}
                    </div>
                )}
            </div>

            <div className="logout">
                <button onClick={handleLogout} className="logout-button">Logout</button>
            </div>
        </div>
    );
}

export default Profile;
