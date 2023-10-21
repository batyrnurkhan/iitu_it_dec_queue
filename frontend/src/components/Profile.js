import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/profile.css'
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
            type: userData["manager_type"]
        }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                // Update the state with the newly called ticket
                setUserData(prevState => ({
                    ...prevState,
                    calledTicket: response.data["ticket"]
                }));

                // Check if audio_url is present in the response
                if (response.data["audio_url"]) {
                    // Create a new audio object and play it
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
                <a href=""><h1>Logout</h1></a>
            </div>
        </div>
    );
}

export default Profile;