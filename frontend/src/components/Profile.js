import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import '../styles/profile.css';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { config } from "../config";
import logo from "../static/logo.png";

const roleTranslations = {
    "MANAGER": "Менеджер",
    "ADMIN": "Администратор",
    "USER": "Пользователь",
};

const typeTranslations = {
    "BACHELOR": "Менеджер бакалавра",
    "MASTER": "Менеджер магистратуры доктарантуры",
    "PHD": "Менеджер по регистрации в PLATONUS",
};

function Profile() {
    document.title = "PROFILE";

    const [userData, setUserData] = useState({});
    const [socket, setSocket] = useState(null);
    const [nextTicket, setNextTicket] = useState(null);
    const [isCallInProgress, setIsCallInProgress] = useState(false);
    const userDataRef = useRef(userData);

    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const ws = new ReconnectingWebSocket(config.queuesSocketUrl);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);

            if (data.type === "ticket_count_update" && data.data) {
                setUserData(prevState => ({
                    ...prevState,
                    ticket_counts: data.data.ticket_counts
                }));
            }

            if (data.type === "ticket_called" && data.data) {
                if (data.data.manager_username === userDataRef.current.username) {
                    setUserData(prevState => ({
                        ...prevState,
                        last_called_ticket: {
                            number: data.data.ticket_number,
                            full_name: data.data.full_name,
                            queue_type: data.data.queue_type
                        }
                    }));
                    setIsCallInProgress(false);
                }
            }

            if (data.type === "new_ticket" && data.data) {
                // Обновляем информацию о следующем талоне если это наша очередь
                if (data.data.queue_type === userDataRef.current.manager_type) {
                    fetchProfileData(); // Перезагружаем профиль для актуальной информации
                }
            }
        };

        setSocket(ws);
        fetchProfileData();

        return () => {
            ws.close();
        };
    }, []);

    const fetchProfileData = () => {
        const token = localStorage.getItem('access_token');
        axios.get(config.profileUrl, {
            headers: {
                'Authorization': `Token ${token}`
            }
        })
        .then((response) => {
            setUserData(response.data);
            setNextTicket(response.data.next_ticket);
        })
        .catch((error) => {
            console.error("Error fetching profile data:", error);
        });
    };

    const handleCallNext = () => {
        setIsCallInProgress(true);

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
                last_called_ticket: {
                    number: response.data.ticket_number,
                    full_name: response.data.full_name,
                    queue_type: userData.manager_type
                }
            }));

            // Обновляем информацию о следующем талоне
            fetchProfileData();

            // Fallback таймер на случай если WebSocket не ответит
            setTimeout(() => {
                setIsCallInProgress(false);
            }, 3000);
        })
        .catch(error => {
            console.error("Error calling the next ticket:", error);
            setIsCallInProgress(false);

            if (error.response && error.response.data.message === "Queue is empty.") {
                alert("Очередь пуста");
            } else {
                alert("Ошибка при вызове следующего талона");
            }
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
                        <span className="detail-label">КОЛИЧЕСТВО ТАЛОНОВ НА ДАННЫЙ МОМЕНТ</span>
                        <span className="detail-value">
                            {userData.ticket_counts ? (
                                <div>
                                    {typeTranslations[userData.manager_type]}: {userData.ticket_counts[userData.manager_type] || 0}
                                </div>
                            ) : (
                                'ОЧЕРЕДЬ ПУСТАЯ'
                            )}
                        </span>
                    </div>
                )}
            </div>

            {userData.role === "MANAGER" && nextTicket && (
                <div className="next-ticket-info">
                    <h3>Следующий в очереди:</h3>
                    <div className="next-ticket-details">
                        <p><strong>ФИО:</strong> {nextTicket.full_name}</p>
                        <p><strong>Номер талона:</strong> {nextTicket.number}</p>
                        <p><strong>Время создания:</strong> {new Date(nextTicket.created_at).toLocaleTimeString()}</p>
                    </div>
                </div>
            )}

            <div className="call-next">
                {userData.role === "MANAGER" && (
                    <div>
                        {userData.last_called_ticket ? (
                            <div className="current-serving">
                                <span className="detail-label">СЕЙЧАС ОБСЛУЖИВАЕТСЯ</span>
                                <div className="serving-info">
                                    <div className="serving-name">{userData.last_called_ticket.full_name}</div>
                                    <div className="serving-ticket">Талон №{userData.last_called_ticket.number}</div>
                                </div>
                                <button
                                    className={`call-next-button ${isCallInProgress ? 'loading' : ''}`}
                                    onClick={handleCallNext}
                                    disabled={isCallInProgress}
                                >
                                    {isCallInProgress ? 'ВЫЗОВ...' : 'СЛЕДУЮЩИЙ ТАЛОН'}
                                </button>
                            </div>
                        ) : (
                            <button
                                className={`call-next-button ${isCallInProgress ? 'loading' : ''}`}
                                onClick={handleCallNext}
                                disabled={isCallInProgress}
                            >
                                {isCallInProgress ? 'ВЫЗОВ...' : 'СЛЕДУЮЩИЙ ТАЛОН'}
                            </button>
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