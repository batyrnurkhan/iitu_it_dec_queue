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
                    calledTicket: response.data["ticket"]
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

    return (
        <div className="profileRoot">
            <div className="profile__qr">
                <div className="profile__green_box">
                    <h1>{userData.username}</h1>
                </div>
            </div>

            <div className="profile__in_process">
                <div className="profile__green_box">
                    <h1>Role: {userData.role}</h1>
                </div>
                <div className="profile__gray_box_l">
                    <h1>Manager Type: {userData["manager_type"]}</h1>
                </div>
            </div>

            <div className="profile__in_queue">
                {userData.role === "MANAGER" && (
                    <div>
                        {userData.calledTicket ? (
                            <div className="profile__green_box">
                                <h1>Last called ticket: {userData.calledTicket}</h1>
                                <button onClick={handleCallNext}>Call Next</button>
                            </div>
                        ) : (
                            <div className="profile__green_box">
                                <button onClick={handleCallNext}>Call Next</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="profile__logo">
                <a href="/logout"><h1>Logout</h1></a> {/* Update this href to correct logout route */}
            </div>
        </div>
    );
}

export default Profile;
