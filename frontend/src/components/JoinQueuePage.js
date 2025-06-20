import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
import { config } from "../config";
import logo from "../static/logo.png";
import axiosInstance from "../axiosInstance";
import notificationService from '../services/NotificationService';

function JoinQueuePage() {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedQueue, setSelectedQueue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

    // Проверяем поддержку и запрашиваем разрешение на уведомления
    useEffect(() => {
        const requestNotifications = async () => {
            if (notificationService.isNotificationSupported()) {
                const permission = notificationService.getPermissionStatus();
                setNotificationPermissionGranted(permission === 'granted');

                if (permission === 'default') {
                    // Браузер САМ покажет окно "Разрешить уведомления?"
                    const result = await notificationService.requestPermission();
                    setNotificationPermissionGranted(result === 'granted');

                    // Показываем тестовое уведомление если разрешили
                    if (result === 'granted') {
                        notificationService.showTestNotification();
                    }
                }
            }
        };

        // Небольшая задержка для лучшего UX
        setTimeout(requestNotifications, 1000);
    }, []);

    const validateForm = () => {
        const newErrors = {};

        if (!fullName.trim()) {
            newErrors.fullName = 'ФИО обязательно для заполнения';
        } else if (fullName.trim().length < 3) {
            newErrors.fullName = 'ФИО должно содержать минимум 3 символа';
        }

        if (!selectedQueue) {
            newErrors.selectedQueue = 'Выберите тип очереди';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setMessage('');
        setErrors({});

        axiosInstance.post(config.joinQueueUrl, {
            type: selectedQueue,
            full_name: fullName.trim()
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.data.message === "НЕ РАБОЧЕЕ ВРЕМЯ") {
                setMessage(response.data.message);
            } else {
                console.log("Response data:", response.data);

                // Сохраняем информацию о талоне для уведомлений
                const ticketInfo = {
                    ticketId: response.data.ticket_id,
                    ticketNumber: response.data.ticket,
                    fullName: response.data.full_name,
                    queueType: selectedQueue,
                    token: response.data.token,
                    createdAt: new Date().toISOString()
                };

                notificationService.setUserTicketInfo(ticketInfo);

                navigate('/ticket', {
                    state: {
                        ticketNumber: response.data.ticket,
                        queueType: selectedQueue,
                        ticketId: response.data.ticket_id,
                        fullName: response.data.full_name,
                        token: response.data.token
                    }
                });
            }
        })
        .catch(error => {
            console.error("Error joining queue:", error.response ? error.response.data : error);

            if (error.response && error.response.data) {
                if (error.response.data.errors) {
                    setErrors(error.response.data.errors);
                } else if (error.response.data.error) {
                    setMessage(error.response.data.error);
                } else {
                    setMessage('Произошла ошибка при получении талона');
                }
            } else {
                setMessage('Ошибка соединения с сервером');
            }
        })
        .finally(() => {
            setIsLoading(false);
        });
    };

    const queueOptions = [
        { value: 'BACHELOR', label: 'Очередь на Бакалавр' },
        { value: 'MASTER', label: 'Очередь на Маг./Докт.' },
        { value: 'PHD', label: 'Очередь на PLATONUS' }
    ];

    return (
        <div className="join-queue-container">
            <img src={logo} alt="Logo" className="logo" />

            {message ? (
                <div className="message-container">
                    <p className={`message ${message === "НЕ РАБОЧЕЕ ВРЕМЯ" ? 'error-message' : ''}`}>
                        {message}
                    </p>
                    {message !== "НЕ РАБОЧЕЕ ВРЕМЯ" && (
                        <button
                            className="retry-button"
                            onClick={() => {
                                setMessage('');
                                setFullName('');
                                setSelectedQueue('');
                            }}
                        >
                            Попробовать снова
                        </button>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="join-queue-form">
                    <h1 className="form-title">Получить талон</h1>

                    <div className="form-group">
                        <label htmlFor="fullName" className="form-label">
                            Введите ваше ФИО *
                        </label>
                        <input
                            type="text"
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Иванов Иван Иванович"
                            className={`form-input ${errors.fullName ? 'error' : ''}`}
                            maxLength="255"
                            disabled={isLoading}
                        />
                        {errors.fullName && (
                            <span className="error-text">{errors.fullName}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="queueType" className="form-label">
                            Выберите тип очереди *
                        </label>
                        <select
                            id="queueType"
                            value={selectedQueue}
                            onChange={(e) => setSelectedQueue(e.target.value)}
                            className={`form-select ${errors.selectedQueue ? 'error' : ''}`}
                            disabled={isLoading}
                        >
                            <option value="">-- Выберите тип --</option>
                            {queueOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {errors.selectedQueue && (
                            <span className="error-text">{errors.selectedQueue}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={`submit-button ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Получение талона...' : 'Получить талон'}
                    </button>

                    <div className="form-info">
                        <p>Ваше ФИО будет объявлено, когда подойдет ваша очередь</p>
                        {notificationPermissionGranted && (
                            <p className="notification-status granted">
                                ✅ Уведомления включены - вы получите уведомление при вызове талона
                            </p>
                        )}
                        {!notificationPermissionGranted && notificationService.isNotificationSupported() && (
                            <p className="notification-status not-granted">
                                🔔 Для получения уведомлений о вызове талона разрешите браузеру отправлять уведомления
                            </p>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
}

export default JoinQueuePage;