import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
import { config } from "../config";
import logo from "../static/logo.png";
import axiosInstance from "../axiosInstance";
import notificationService from '../services/NotificationService';

function JoinQueuePage() {
    const navigate = useNavigate();

    // State management
    const [message, setMessage] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedQueue, setSelectedQueue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isNotificationSupported, setIsNotificationSupported] = useState(false);

    // Queue options configuration
    const queueOptions = useMemo(() => [
        { value: 'BACHELOR', label: 'Очередь на Бакалавр', emoji: '🎓', description: 'Для студентов бакалавриата' },
        { value: 'MASTER', label: 'Очередь на Маг./Докт.', emoji: '📚', description: 'Для магистрантов и докторантов' },
        { value: 'PHD', label: 'Очередь на PLATONUS', emoji: '💻', description: 'Вопросы по системе PLATONUS' }
    ], []);

    // Form validation
    const validateForm = useCallback(() => {
        const newErrors = {};

        // Validate full name
        if (!fullName.trim()) {
            newErrors.fullName = 'ФИО обязательно для заполнения';
        } else if (fullName.trim().length < 3) {
            newErrors.fullName = 'ФИО должно содержать минимум 3 символа';
        } else if (fullName.trim().length > 255) {
            newErrors.fullName = 'ФИО не должно превышать 255 символов';
        } else if (!/^[а-яёА-ЯЁa-zA-Z\s\-'\.]+$/u.test(fullName.trim())) {
            newErrors.fullName = 'ФИО может содержать только буквы, пробелы, дефисы и апострофы';
        }

        // Validate queue selection
        if (!selectedQueue) {
            newErrors.selectedQueue = 'Выберите тип очереди';
        } else if (!queueOptions.find(option => option.value === selectedQueue)) {
            newErrors.selectedQueue = 'Выбранный тип очереди недоступен';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [fullName, selectedQueue, queueOptions]);

    // Clear field error on change
    const clearFieldError = useCallback((fieldName) => {
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
    }, [errors]);

    // Handle form submission
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            // Haptic feedback для ошибки валидации
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            return;
        }

        setIsLoading(true);
        setMessage('');
        setErrors({});

        try {
            const response = await axiosInstance.post(config.joinQueueUrl, {
                type: selectedQueue,
                full_name: fullName.trim()
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 секунд таймаут
            });

            if (response.data.message === "НЕ РАБОЧЕЕ ВРЕМЯ") {
                setMessage(response.data.message);
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            } else {
                console.log("Response data:", response.data);

                // Haptic feedback для успеха
                if (navigator.vibrate) {
                    navigator.vibrate([50, 25, 50, 25, 50]);
                }

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

                // Плавный переход с задержкой для лучшего UX
                setTimeout(() => {
                    navigate('/ticket', {
                        state: {
                            ticketNumber: response.data.ticket,
                            queueType: selectedQueue,
                            ticketId: response.data.ticket_id,
                            fullName: response.data.full_name,
                            token: response.data.token
                        }
                    });
                }, 600);
            }
        } catch (error) {
            console.error("Error joining queue:", error);

            // Haptic feedback для ошибки
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }

            if (error.response && error.response.data) {
                if (error.response.data.errors) {
                    setErrors(error.response.data.errors);
                } else if (error.response.data.error) {
                    setMessage(error.response.data.error);
                } else {
                    setMessage('Произошла ошибка при получении талона. Попробуйте еще раз.');
                }
            } else if (error.code === 'ECONNABORTED') {
                setMessage('Превышено время ожидания. Проверьте интернет-соединение и попробуйте снова.');
            } else {
                setMessage('Ошибка соединения с сервером. Проверьте интернет-соединение.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [validateForm, selectedQueue, fullName, navigate]);

    // Reset form
    const handleRetry = useCallback(() => {
        setMessage('');
        setFullName('');
        setSelectedQueue('');
        setErrors({});

        // Фокус на первое поле с задержкой
        setTimeout(() => {
            const firstInput = document.getElementById('fullName');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }, []);

    // Notification status helpers
    const getNotificationStatusIcon = useCallback(() => {
        if (!isNotificationSupported) {
            return '📱';
        }
        return notificationPermissionGranted ? '✅' : '🔔';
    }, [isNotificationSupported, notificationPermissionGranted]);

    const getNotificationStatusText = useCallback(() => {
        if (!isNotificationSupported) {
            return 'Уведомления не поддерживаются на этом устройстве';
        }

        if (notificationPermissionGranted) {
            return 'Уведомления включены - вы получите уведомление при вызове талона';
        }

        return 'Разрешите уведомления для получения оповещений о вызове талона';
    }, [isNotificationSupported, notificationPermissionGranted]);

    // Initialize form visibility animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsFormVisible(true);
        }, 150);
        return () => clearTimeout(timer);
    }, []);

    // Setup notifications
    useEffect(() => {
        const setupNotifications = async () => {
            try {
                const isSupported = notificationService.isNotificationSupported();
                setIsNotificationSupported(isSupported);

                if (isSupported) {
                    const permission = notificationService.getPermissionStatus();
                    setNotificationPermissionGranted(permission === 'granted');

                    if (permission === 'default') {
                        // Запрашиваем разрешение с задержкой для лучшего UX
                        const timer = setTimeout(async () => {
                            try {
                                const result = await notificationService.requestPermission();
                                setNotificationPermissionGranted(result === 'granted');

                                if (result === 'granted') {
                                    notificationService.showTestNotification();
                                }
                            } catch (error) {
                                console.warn('Notification permission request failed:', error);
                            }
                        }, 2000);

                        return () => clearTimeout(timer);
                    }
                }
            } catch (error) {
                console.warn('Notification setup failed:', error);
            }
        };

        setupNotifications();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // ESC для сброса формы
            if (event.key === 'Escape' && !isLoading) {
                if (message) {
                    handleRetry();
                }
            }

            // Enter в селекте для отправки формы
            if (event.key === 'Enter' && event.target.tagName === 'SELECT') {
                event.preventDefault();
                if (!isLoading && fullName && selectedQueue) {
                    const form = document.querySelector('.join-queue-form');
                    if (form) {
                        form.requestSubmit();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [message, isLoading, fullName, selectedQueue, handleRetry]);

    // Set page title
    useEffect(() => {
        document.title = "Получить талон - IITU";
    }, []);

    return (
        <div className="join-queue-container">
            <img
                src={logo}
                alt="Логотип IITU"
                className="logo"
                onError={(e) => {
                    e.target.style.display = 'none';
                }}
            />

            {message ? (
                <div className={`message-container ${isFormVisible ? 'visible' : ''}`}>
                    <div className={`message ${message === "НЕ РАБОЧЕЕ ВРЕМЯ" ? 'error-message' : ''}`}>
                        {message === "НЕ РАБОЧЕЕ ВРЕМЯ" ? (
                            <>
                                <span>⏰</span>
                                <span>{message}</span>
                            </>
                        ) : (
                            message
                        )}
                    </div>
                    {message !== "НЕ РАБОЧЕЕ ВРЕМЯ" && (
                        <button
                            className="retry-button"
                            onClick={handleRetry}
                            type="button"
                            aria-label="Попробовать заново"
                        >
                            🔄 Попробовать снова
                        </button>
                    )}
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className={`join-queue-form ${isFormVisible ? 'visible' : ''}`}
                    noValidate
                    aria-label="Форма получения талона"
                >
                    <h1 className="form-title">
                        <span>🎫</span>
                        <span>Получить талон</span>
                    </h1>

                    <div className="form-group">
                        <label htmlFor="fullName" className="form-label">
                            <span>👤</span>
                            <span>Введите ваше ФИО</span>
                        </label>
                        <input
                            type="text"
                            id="fullName"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                clearFieldError('fullName');
                            }}
                            placeholder="Иванов Иван Иванович"
                            className={`form-input ${errors.fullName ? 'error' : ''}`}
                            maxLength="255"
                            disabled={isLoading}
                            autoComplete="name"
                            autoFocus
                            aria-describedby={errors.fullName ? "fullName-error" : "fullName-help"}
                            aria-invalid={!!errors.fullName}
                            required
                        />
                        {errors.fullName ? (
                            <span
                                className="error-text"
                                id="fullName-error"
                                role="alert"
                                aria-live="polite"
                            >
                                {errors.fullName}
                            </span>
                        ) : (
                            <span id="fullName-help" className="sr-only">
                                Введите ваше полное имя для объявления в очереди
                            </span>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="queueType" className="form-label">
                            <span>📋</span>
                            <span>Выберите тип очереди</span>
                        </label>
                        <select
                            id="queueType"
                            value={selectedQueue}
                            onChange={(e) => {
                                setSelectedQueue(e.target.value);
                                clearFieldError('selectedQueue');
                            }}
                            className={`form-select ${errors.selectedQueue ? 'error' : ''}`}
                            disabled={isLoading}
                            aria-describedby={errors.selectedQueue ? "queueType-error" : "queueType-help"}
                            aria-invalid={!!errors.selectedQueue}
                            required
                        >
                            <option value="">-- Выберите тип очереди --</option>
                            {queueOptions.map(option => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                    title={option.description}
                                >
                                    {option.emoji} {option.label}
                                </option>
                            ))}
                        </select>
                        {errors.selectedQueue ? (
                            <span
                                className="error-text"
                                id="queueType-error"
                                role="alert"
                                aria-live="polite"
                            >
                                {errors.selectedQueue}
                            </span>
                        ) : (
                            <span id="queueType-help" className="sr-only">
                                Выберите подходящий тип очереди для вашего вопроса
                            </span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={`submit-button ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading || !fullName.trim() || !selectedQueue}
                        aria-describedby="submit-button-description"
                    >
                        {isLoading ? (
                            <>
                                <span>⏳</span>
                                <span>Получение талона...</span>
                            </>
                        ) : (
                            <>
                                <span>✨</span>
                                <span>Получить талон</span>
                            </>
                        )}
                    </button>

                    <div className="form-info">
                        <p id="submit-button-description">
                            <span>💬</span>
                            <span>Ваше ФИО будет объявлено, когда подойдет ваша очередь</span>
                        </p>

                        <div className={`notification-status ${notificationPermissionGranted ? 'granted' : 'not-granted'}`}>
                            <span>{getNotificationStatusIcon()}</span>
                            <span>{getNotificationStatusText()}</span>
                        </div>

                        {!notificationPermissionGranted && isNotificationSupported && (
                            <p style={{
                                fontSize: '0.75rem',
                                marginTop: 'var(--space-2)',
                                opacity: 0.8,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-1)'
                            }}>
                                <span>💡</span>
                                <span>Совет: Для лучшего опыта на мобильных устройствах добавьте сайт на домашний экран</span>
                            </p>
                        )}

                        {selectedQueue && (
                            <p style={{
                                fontSize: '0.75rem',
                                marginTop: 'var(--space-3)',
                                padding: 'var(--space-2)',
                                background: 'rgba(102, 126, 234, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-1)'
                            }}>
                                <span>ℹ️</span>
                                <span>
                                    {queueOptions.find(opt => opt.value === selectedQueue)?.description || 'Описание очереди'}
                                </span>
                            </p>
                        )}
                    </div>
                </form>
            )}

            {/* Скрытый элемент для screen readers */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {isLoading && "Обрабатывается запрос на получение талона"}
                {message && !isLoading && `Сообщение: ${message}`}
            </div>
        </div>
    );
}

export default JoinQueuePage;