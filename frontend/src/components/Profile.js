import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/profile.css';  // Make sure this path is correct
import ReconnectingWebSocket from 'reconnecting-websocket';
import { config } from "../config";
import logo from "../static/logo.png";

const roleTranslations = {
    "MANAGER": "Менеджер",
    "ADMIN": "Администратор",
    "USER": "Пользователь",
    // Add other roles as needed
};

const typeTranslations = {
    "BACHELOR": "Менеджер бакалавра",
    "MASTER": "Менеджер магистратуры доктарантуры",
    "PHD": "Менеджер по регистрации в PLATONUS",
    // Add other types as needed
};

function Profile() {
    document.title = "PROFILE";

    const [userData, setUserData] = useState({});
    const [socket, setSocket] = useState(null);
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.ticket_counts) {
                setUserData(prevState => ({
                    ...prevState,
                    ticket_counts: data.ticket_counts
                }));
            }
            if (data.action && data.action === "call_next" && data.ticket_number) {
                setUserData(prevState => ({
                    ...prevState,
                    calledTicket: data.ticket_number
                }));
                if (data.audio_url) {
                    setAudioQueue(prevQueue => [...prevQueue, data.audio_url]);
                }
            }
        };

        setSocket(ws);

        axios.get(config.profileUrl, {
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

    useEffect(() => {
        if (audioQueue.length > 0 && !isPlaying) {
            setIsPlaying(true);
            const audio = new Audio(audioQueue[0]);
            audio.play().then(() => {
                // Playback started successfully
            }).catch(error => {
                console.error("Error playing the audio:", error);
            });
            audio.onended = () => {
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
        }
    }, [audioQueue, isPlaying]);

    const handleCallNext = () => {
        axios.post(config.callNextUrl, {
            type: userData.manager_type
        }, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                setUserData(prevState => ({
                    ...prevState,
                    calledTicket: response.data.ticket_number
                }));
            })
            .catch(error => {
                console.error("Error calling the next ticket:", error);
            });
    };

    const handleLogout = () => {
        axios.post(config.logoutUrl, {}, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
            .then(response => {
                console.log("Logout successful:", response.data.message);
                localStorage.removeItem('access_token');
                window.location.href = config.logoutRedirectUrl;
            })
            .catch(error => {
                console.error("Error during logout:", error);
            });
    };

    const translatedRole = roleTranslations[userData.role] || userData.role;
    const translatedType = typeTranslations[userData.manager_type] || userData.manager_type;

    return (
        <div className="profile-container">
            <img src={logo} alt="Logo" className="logo" />
            <div className="profile-header">
                <h1 className="profile-username">{userData.username}</h1>
            </div>

            <div className="profile-details">
                <div className="profile-detail">
                    <span className="detail-label">РОЛЬ</span>
                    <span className="detail-value">{translatedRole}</span>
                </div>
                <div className="profile-detail">
                    <span className="detail-label">ТИП</span>
                    <span className="detail-value">{translatedType}</span>
                </div>
                {userData.role === "MANAGER" && (
                    <div className="profile-detail">
                        <span className="detail-label">ОБНОВИТЕ ЧТОБЫ ПОСМОТРЕТЬ КОЛИЧЕСТВО ТАЛОНОВ НА ДАННЫЙ МОМЕНТ</span>
                        <span className="detail-value">
                            {userData.ticket_counts ? (
                                typeof userData.ticket_counts === 'string' ? (
                                    userData.ticket_counts
                                ) : (
                                    Object.entries(userData.ticket_counts).map(([type, count]) => (
                                        `${count}`
                                    )).join(', ')
                                )
                            ) : (
                                'ОЧЕРЕДЬ ПУСТАЯ'
                            )}
                        </span>
                    </div>
                )}
            </div>

            <div className="call-next">
                {userData.role === "MANAGER" && (
                    <div>
                        {userData.calledTicket ? (
                            <div>
                                <span className="detail-label">СЕЙЧАС ОБСЛУЖИВАЕТСЯ ТАЛОН</span>
                                <span className="detail-value last-called-ticket">{userData.calledTicket}</span>
                                <button className="call-next-button" onClick={handleCallNext}>СЛЕДУЮЩИЙ ТАЛОН</button>
                            </div>
                        ) : (
                            <button className="call-next-button" onClick={handleCallNext}>СЛЕДУЮЩИЙ ТАЛОН</button>
                        )}
                    </div>
                )}
            </div>

            <div className="logout">
                <button onClick={handleLogout} className="logout-button">ВЫЙТИ С СИСТЕМЫ</button>
            </div>
        </div>
    );
}

export default Profile;
