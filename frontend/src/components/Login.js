import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import { config } from "../config";
import logo from "../static/logo.png";

function Login() {
    // State management
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [generalError, setGeneralError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const navigate = useNavigate();
    const usernameRef = useRef(null);
    const passwordRef = useRef(null);

    // Form validation
    const validateForm = useCallback(() => {
        const newErrors = {};

        // Validate username
        if (!username.trim()) {
            newErrors.username = 'Имя пользователя обязательно';
        } else if (username.trim().length < 3) {
            newErrors.username = 'Имя пользователя должно содержать минимум 3 символа';
        } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
            newErrors.username = 'Имя пользователя может содержать только буквы, цифры и подчеркивания';
        }

        // Validate password
        if (!password) {
            newErrors.password = 'Пароль обязателен';
        } else if (password.length < 4) {
            newErrors.password = 'Пароль должен содержать минимум 4 символа';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [username, password]);

    // Clear field error on change
    const clearFieldError = useCallback((fieldName) => {
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
        if (generalError) {
            setGeneralError('');
        }
    }, [errors, generalError]);

    // Handle caps lock detection
    const handleKeyPress = useCallback((event) => {
        const capsLock = event.getModifierState && event.getModifierState('CapsLock');
        setCapsLockOn(capsLock);
    }, []);

    // Handle form submission
    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            // Haptic feedback для ошибки валидации
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            return;
        }

        setIsLoading(true);
        setGeneralError('');
        setErrors({});

        try {
            const response = await axios.post(config.loginUrl, {
                username: username.trim(),
                password: password,
            }, {
                timeout: 10000, // 10 секунд таймаут
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Успешный вход
            const token = response.data.token;
            localStorage.setItem('access_token', token);

            // Сохраняем username если включен "Запомнить меня"
            if (rememberMe) {
                localStorage.setItem('remembered_username', username.trim());
            } else {
                localStorage.removeItem('remembered_username');
            }

            // Haptic feedback для успеха
            if (navigator.vibrate) {
                navigator.vibrate([50, 25, 50]);
            }

            // Плавный переход
            setTimeout(() => {
                navigate('/profile');
            }, 300);

        } catch (error) {
            console.error("Login error:", error);

            // Haptic feedback для ошибки
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 401) {
                    setGeneralError('Неверное имя пользователя или пароль');
                } else if (status === 429) {
                    setGeneralError('Слишком много попыток входа. Попробуйте позже');
                } else if (status === 500) {
                    setGeneralError('Ошибка сервера. Попробуйте позже');
                } else if (data && data.errors) {
                    setErrors(data.errors);
                } else if (data && data.error) {
                    setGeneralError(data.error);
                } else {
                    setGeneralError('Произошла ошибка при входе в систему');
                }
            } else if (error.code === 'ECONNABORTED') {
                setGeneralError('Превышено время ожидания. Проверьте интернет-соединение');
            } else {
                setGeneralError('Ошибка соединения с сервером');
            }

            // Фокус на поле с ошибкой
            setTimeout(() => {
                if (errors.username && usernameRef.current) {
                    usernameRef.current.focus();
                } else if (errors.password && passwordRef.current) {
                    passwordRef.current.focus();
                }
            }, 100);
        } finally {
            setIsLoading(false);
        }
    }, [validateForm, username, password, rememberMe, navigate, errors]);

    // Toggle password visibility
    const togglePasswordVisibility = useCallback(() => {
        setShowPassword(prev => !prev);
    }, []);

    // Load remembered username
    useEffect(() => {
        const rememberedUsername = localStorage.getItem('remembered_username');
        if (rememberedUsername) {
            setUsername(rememberedUsername);
            setRememberMe(true);
            // Фокус на поле пароля если username уже заполнен
            setTimeout(() => {
                if (passwordRef.current) {
                    passwordRef.current.focus();
                }
            }, 100);
        } else {
            // Фокус на поле username
            setTimeout(() => {
                if (usernameRef.current) {
                    usernameRef.current.focus();
                }
            }, 100);
        }
    }, []);

    // Check if already logged in
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            // Проверяем валидность токена
            axios.get(config.profileUrl, {
                headers: {
                    'Authorization': `Token ${token}`
                }
            })
            .then(() => {
                navigate('/profile');
            })
            .catch(() => {
                // Токен недействителен, удаляем его
                localStorage.removeItem('access_token');
            });
        }
    }, [navigate]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // ESC для очистки ошибок
            if (event.key === 'Escape') {
                setGeneralError('');
                setErrors({});
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Set page title
    useEffect(() => {
        document.title = "Вход в систему - IITU";
    }, []);

    return (
        <div className="login-container">
            {/* Логотип */}
            <img
                src={logo}
                alt="Логотип IITU"
                className="login-logo"
                onError={(e) => {
                    e.target.style.display = 'none';
                }}
            />

            <form
                onSubmit={handleSubmit}
                className="login-form"
                noValidate
                aria-label="Форма входа в систему"
            >
                <h1 className="login-title">Вход в систему</h1>
                <p className="login-subtitle">
                    Введите свои учетные данные для доступа к системе управления очередью
                </p>

                {/* Общая ошибка */}
                {generalError && (
                    <div className="login-error" role="alert" aria-live="polite">
                        {generalError}
                    </div>
                )}

                {/* Поле имени пользователя */}
                <div className="form-group">
                    <label htmlFor="username" className="form-label">
                        <span>👤</span>
                        <span>Имя пользователя</span>
                    </label>
                    <input
                        ref={usernameRef}
                        type="text"
                        id="username"
                        className={`login-input ${errors.username ? 'error' : ''}`}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            clearFieldError('username');
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder="Введите имя пользователя"
                        disabled={isLoading}
                        autoComplete="username"
                        aria-describedby={errors.username ? "username-error" : undefined}
                        aria-invalid={!!errors.username}
                        required
                    />
                    {errors.username && (
                        <span
                            className="error-text"
                            id="username-error"
                            role="alert"
                            aria-live="polite"
                        >
                            {errors.username}
                        </span>
                    )}
                </div>

                {/* Поле пароля */}
                <div className="form-group">
                    <label htmlFor="password" className="form-label">
                        <span>🔒</span>
                        <span>Пароль</span>
                    </label>
                    <div className="password-wrapper">
                        <input
                            ref={passwordRef}
                            type={showPassword ? "text" : "password"}
                            id="password"
                            className={`login-input ${errors.password ? 'error' : ''}`}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                clearFieldError('password');
                            }}
                            onKeyPress={handleKeyPress}
                            placeholder="Введите пароль"
                            disabled={isLoading}
                            autoComplete="current-password"
                            aria-describedby={errors.password ? "password-error" : undefined}
                            aria-invalid={!!errors.password}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={togglePasswordVisibility}
                            disabled={isLoading}
                            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                        >
                            {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                    </div>
                    {errors.password && (
                        <span
                            className="error-text"
                            id="password-error"
                            role="alert"
                            aria-live="polite"
                        >
                            {errors.password}
                        </span>
                    )}
                    {capsLockOn && (
                        <div className="caps-warning">
                            Включен Caps Lock
                        </div>
                    )}
                </div>

                {/* Чекбокс "Запомнить меня" */}
                <div className="form-group">
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}>
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            disabled={isLoading}
                            style={{
                                width: '16px',
                                height: '16px',
                                accentColor: 'var(--primary-600)'
                            }}
                        />
                        <span>Запомнить имя пользователя</span>
                    </label>
                </div>

                {/* Кнопка входа */}
                <button
                    type="submit"
                    className={`login-button ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading || !username.trim() || !password}
                    aria-describedby="login-button-description"
                >
                    {isLoading ? (
                        <>
                            <span>⏳</span>
                            <span>Вход...</span>
                        </>
                    ) : (
                        <>
                            <span>🚀</span>
                            <span>Войти</span>
                        </>
                    )}
                </button>

                {/* Футер формы */}
                <div className="login-footer">
                    <p id="login-button-description">
                        Используйте учетные данные, предоставленные администратором системы
                    </p>

                    {/* Дополнительная информация */}
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: 'var(--space-4)',
                        textAlign: 'center',
                        lineHeight: 1.4
                    }}>
                        <p style={{marginBottom: 'var(--space-2)'}}>
                            💡 Совет: Используйте пробел для быстрого вызова талонов в режиме менеджера
                        </p>
                        <p>
                            🔒 Ваши данные защищены и передаются по безопасному соединению
                        </p>
                    </div>
                </div>
            </form>

            {/* Скрытый элемент для screen readers */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {isLoading && "Выполняется вход в систему"}
                {generalError && `Ошибка входа: ${generalError}`}
                {Object.keys(errors).length > 0 && "Обнаружены ошибки в форме"}
            </div>
        </div>
    );
}

export default Login;