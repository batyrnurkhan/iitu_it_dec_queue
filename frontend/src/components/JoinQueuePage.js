import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/joinQueue.css';
import { config, getQueueDisplayName, getQueueDescription, getQueueEmoji } from "../config";
import logo from "../static/logo.png";
import axiosInstance, { queueAPI } from "../axiosInstance";
import notificationService from '../services/NotificationService';

function JoinQueuePage() {
    const navigate = useNavigate();

    // State management
    const [message, setMessage] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedQueue, setSelectedQueue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingQueueTypes, setIsLoadingQueueTypes] = useState(true);
    const [errors, setErrors] = useState({});
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isNotificationSupported, setIsNotificationSupported] = useState(false);
    const [queueTypes, setQueueTypes] = useState([]);

    // Загружаем типы очередей с сервера
    const loadQueueTypes = useCallback(async () => {
        try {
            setIsLoadingQueueTypes(true);
            const response = await queueAPI.getQueueTypes();

            if (response.data && Array.isArray(response.data)) {
                setQueueTypes(response.data);
                console.log('Loaded queue types:', response.data);
            } else {
                throw new Error('Invalid queue types data format');
            }
        } catch (error) {
            console.error('Error loading queue types:', error);

            // Fallback to static queue types if API fails
            const fallbackQueueTypes = [
                { name: 'BACHELOR_GRANT', display_name: 'Бакалавр грант' },
                { name: 'BACHELOR_PAID', display_name: 'Бакалавр платное' },
                { name: 'MASTER', display_name: 'Магистратура' },
                { name: 'PHD', display_name: 'PhD' },
                { name: 'PLATONUS', display_name: 'Platonus' }
            ];

            setQueueTypes(fallbackQueueTypes);
            console.warn('Using fallback queue types due to API error');
        } finally {
            setIsLoadingQueueTypes(false);
        }
    }, []);

    // Queue options configuration based on loaded data
    const queueOptions = useMemo(() => {
        return queueTypes.map(queueType => ({
            value: queueType.name,
            label: queueType.display_name || getQueueDisplayName(queueType.name),
            emoji: getQueueEmoji(queueType.name),
            description: getQueueDescription(queueType.name),
            ticketRange: queueType.min_ticket_number && queueType.max_ticket_number
                ? `${queueType.min_ticket_number}-${queueType.max_ticket_number}`
                : null
        }));
    }, [queueTypes]);

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
            const response = await queueAPI.joinQueue(selectedQueue, fullName.trim());

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
                    queueType: response.data.queue_type || selectedQueue,
                    queueTypeDisplay: response.data.queue_type_display || getQueueDisplayName(selectedQueue),
                    token: response.data.token,
                    createdAt: new Date().toISOString()
                };

                notificationService.setUserTicketInfo(ticketInfo);

                // Плавный переход с задержкой для лучшего UX
                setTimeout(() => {
                    navigate('/ticket', {
                        state: {
                            ticketNumber: response.data.ticket,
                            queueType: response.data.queue_type || selectedQueue,
                            queueTypeDisplay: response.data.queue_type_display || getQueueDisplayName(selectedQueue),
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

    // Load queue types on mount
    useEffect(() => {
        loadQueueTypes();
    }, [loadQueueTypes]);

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

                        {isLoadingQueueTypes ? (
                            <div className="loading-select">
                                <span>⏳</span>
                                <span>Загрузка типов очередей...</span>
                            </div>
                        ) : (
                            <select
                                id="queueType"
                                value={selectedQueue}
                                onChange={(e) => {
                                    setSelectedQueue(e.target.value);
                                    clearFieldError('selectedQueue');
                                }}
                                className={`form-select ${errors.selectedQueue ? 'error' : ''}`}
                                disabled={isLoading || queueOptions.length === 0}
                                aria-describedby={errors.selectedQueue ? "queueType-error" : "queueType-help"}
                                aria-invalid={!!errors.selectedQueue}
                                required
                            >
                                <option value="">-- Выберите тип очереди --</option>
                                {queueOptions.map(option => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                        title={`${option.description}${option.ticketRange ? ` (${option.ticketRange})` : ''}`}
                                    >
                                        {option.emoji} {option.label}
                                        {option.ticketRange && ` (${option.ticketRange})`}
                                    </option>
                                ))}
                            </select>
                        )}

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
                        disabled={isLoading || !fullName.trim() || !selectedQueue || isLoadingQueueTypes}
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

                        {selectedQueue && queueOptions.length > 0 && (
                            <div style={{
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
                                <div>
                                    <div>
                                        <strong>{queueOptions.find(opt => opt.value === selectedQueue)?.label}</strong>
                                    </div>
                                    <div style={{ marginTop: '4px', opacity: 0.8 }}>
                                        {queueOptions.find(opt => opt.value === selectedQueue)?.description}
                                    </div>
                                    {queueOptions.find(opt => opt.value === selectedQueue)?.ticketRange && (
                                        <div style={{ marginTop: '4px', opacity: 0.7, fontSize: '0.7rem' }}>
                                            Номера талонов: {queueOptions.find(opt => opt.value === selectedQueue)?.ticketRange}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {queueOptions.length === 0 && !isLoadingQueueTypes && (
                            <div style={{
                                fontSize: '0.75rem',
                                marginTop: 'var(--space-3)',
                                padding: 'var(--space-2)',
                                background: 'rgba(255, 193, 7, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-1)'
                            }}>
                                <span>⚠️</span>
                                <span>Типы очередей временно недоступны. Попробуйте обновить страницу.</span>
                            </div>
                        )}
                    </div>
                </form>
            )}

            {/* Скрытый элемент для screen readers */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {isLoading && "Обрабатывается запрос на получение талона"}
                {isLoadingQueueTypes && "Загружаются типы очередей"}
                {message && !isLoading && `Сообщение: ${message}`}
            </div>
        </div>
    );
}

export default JoinQueuePage;