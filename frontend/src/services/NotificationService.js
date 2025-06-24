// services/NotificationService.js

class NotificationService {
    constructor() {
        // ИСПРАВЛЕНО: Проверяем поддержку ПЕРЕД обращением к Notification
        this.isSupported = typeof Notification !== 'undefined' && 'Notification' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.userTicketInfo = null;

        // Дополнительная проверка для iOS
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isStandalone = window.navigator.standalone;

        console.log('NotificationService initialized:', {
            isSupported: this.isSupported,
            permission: this.permission,
            isIOS: this.isIOS,
            isStandalone: this.isStandalone
        });
    }

    // Проверка поддержки уведомлений
    isNotificationSupported() {
        return this.isSupported;
    }

    // Получение текущего статуса разрешений
    getPermissionStatus() {
        return this.permission;
    }

    // Запрос разрешения на уведомления
    async requestPermission() {
        if (!this.isSupported) {
            console.warn('Browser does not support notifications');
            return 'denied';
        }

        if (this.permission === 'granted') {
            return 'granted';
        }

        if (this.permission === 'denied') {
            return 'denied';
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    // Сохранение информации о талоне пользователя
    setUserTicketInfo(ticketInfo) {
        this.userTicketInfo = ticketInfo;
        try {
            localStorage.setItem('userTicketInfo', JSON.stringify(ticketInfo));
        } catch (error) {
            console.error('Error saving ticket info:', error);
        }
    }

    // Получение информации о талоне пользователя
    getUserTicketInfo() {
        if (!this.userTicketInfo) {
            try {
                const stored = localStorage.getItem('userTicketInfo');
                if (stored) {
                    this.userTicketInfo = JSON.parse(stored);
                }
            } catch (error) {
                console.error('Error loading ticket info:', error);
            }
        }
        return this.userTicketInfo;
    }

    // Очистка информации о талоне
    clearUserTicketInfo() {
        this.userTicketInfo = null;
        try {
            localStorage.removeItem('userTicketInfo');
        } catch (error) {
            console.error('Error clearing ticket info:', error);
        }
    }

    // ИСПРАВЛЕНО: Отправка уведомления с fallback для iOS
    showTicketCalledNotification(ticketData) {
        console.log('showTicketCalledNotification called with:', ticketData);

        // Если нет поддержки уведомлений или это iOS Safari - используем fallback
        if (!this.isSupported || (this.isIOS && !this.isStandalone)) {
            this.showFallbackNotification(ticketData);
            return;
        }

        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted, using fallback');
            this.showFallbackNotification(ticketData);
            return;
        }

        const userTicket = this.getUserTicketInfo();
        if (!userTicket || !this.isOurTicket(ticketData, userTicket)) {
            return;
        }

        try {
            const title = '🔔 Ваш талон вызван!';
            const body = `${ticketData.full_name}, подойдите к ${this.getLocationText(ticketData.manager_username)}`;

            // Упрощенные опции без actions (для совместимости)
            const options = {
                body: body,
                icon: '/static/logo.png',
                badge: '/static/logo.png',
                tag: 'ticket-called',
                requireInteraction: true,
                vibrate: [200, 100, 200],
                data: {
                    ticketId: ticketData.ticket_id,
                    ticketNumber: ticketData.ticket_number,
                    fullName: ticketData.full_name,
                    timestamp: new Date().toISOString()
                }
            };

            const notification = new Notification(title, options);

            notification.onclick = () => {
                window.focus();
                notification.close();
                if (window.location.pathname !== '/ticket') {
                    window.location.href = '/ticket';
                }
            };

            notification.onshow = () => {
                console.log('Notification shown');
                setTimeout(() => {
                    notification.close();
                }, 10000);
            };

            notification.onerror = (error) => {
                console.error('Notification error:', error);
                this.showFallbackNotification(ticketData);
            };

            return notification;

        } catch (error) {
            console.error('Error showing notification:', error);
            this.showFallbackNotification(ticketData);
        }
    }

    // НОВЫЙ МЕТОД: Fallback уведомление для неподдерживаемых устройств
    showFallbackNotification(ticketData) {
        console.log('Using fallback notification for:', ticketData);

        // Вибрация (если поддерживается)
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }

        // Визуальный баннер
        this.showVisualBanner(ticketData);

        // Звуковое уведомление
        this.playNotificationSound();

        // Простой alert как последний fallback
        setTimeout(() => {
            alert(`🔔 ВАШ ТАЛОН ВЫЗВАН!\n${ticketData.full_name}, подойдите к ${this.getLocationText(ticketData.manager_username)}`);
        }, 500);
    }

    // НОВЫЙ МЕТОД: Визуальный баннер
    showVisualBanner(ticketData) {
        // Создаем баннер уведомления
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: bold;
            text-align: center;
            max-width: 90vw;
            border: 3px solid #fff;
            animation: slideDownBounce 0.6s ease-out;
        `;

        banner.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">🔔 ВАШ ТАЛОН ВЫЗВАН!</div>
            <div style="font-size: 18px; margin-bottom: 8px;">${ticketData.full_name}</div>
            <div style="font-size: 14px; opacity: 0.9;">Подойдите к ${this.getLocationText(ticketData.manager_username)}</div>
            <div style="font-size: 12px; margin-top: 10px; opacity: 0.8;">Нажмите для закрытия</div>
        `;

        // Добавляем анимацию
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideDownBounce {
                    0% { 
                        transform: translateX(-50%) translateY(-100px) scale(0.8); 
                        opacity: 0; 
                    }
                    60% { 
                        transform: translateX(-50%) translateY(10px) scale(1.05); 
                        opacity: 1; 
                    }
                    100% { 
                        transform: translateX(-50%) translateY(0) scale(1); 
                        opacity: 1; 
                    }
                }
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.02); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(banner);

        // Пульсация каждые 2 секунды
        const pulseInterval = setInterval(() => {
            banner.style.animation = 'pulse 0.3s ease-in-out';
            setTimeout(() => {
                banner.style.animation = '';
            }, 300);
        }, 2000);

        // Убираем баннер через 8 секунд
        setTimeout(() => {
            clearInterval(pulseInterval);
            banner.style.animation = 'slideDownBounce 0.5s ease-out reverse';
            setTimeout(() => {
                if (banner.parentNode) {
                    banner.parentNode.removeChild(banner);
                }
            }, 500);
        }, 8000);

        // Клик для закрытия
        banner.onclick = () => {
            clearInterval(pulseInterval);
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        };
    }

    // НОВЫЙ МЕТОД: Звуковое уведомление
    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Последовательность звуков
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio notification not available:', error);
        }
    }

    // Отправка общего уведомления
    showNotification(title, message, options = {}) {
        if (!this.isSupported || this.permission !== 'granted') {
            console.warn('Using fallback for general notification');
            alert(`${title}\n${message}`);
            return;
        }

        const defaultOptions = {
            icon: '/static/logo.png',
            badge: '/static/logo.png',
            tag: 'general-notification',
            ...options
        };

        try {
            const notification = new Notification(title, {
                body: message,
                ...defaultOptions
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
            alert(`${title}\n${message}`);
        }
    }

    // Проверка, является ли талон нашим
    isOurTicket(ticketData, userTicket) {
        return (
            ticketData.ticket_id === userTicket.ticketId ||
            (ticketData.ticket_number === userTicket.ticketNumber &&
             ticketData.full_name === userTicket.fullName &&
             ticketData.queue_type === userTicket.queueType)
        );
    }

    // Получение текста местоположения менеджера
    getLocationText(managerUsername) {
        if (!managerUsername) return 'менеджеру';

        const username = managerUsername.toLowerCase();

        if (username.includes('auditoria111') || username.includes('aauditoria111')) {
            return 'аудитории 111';
        } else if (username.includes('auditoria303')) {
            return 'аудитории 303';
        } else if (username.includes('auditoria305')) {
            return 'аудитории 305';
        } else if (username.includes('auditoria306')) {
            return 'аудитории 306';
        } else {
            const stolNumber = username.charAt(username.length - 1);
            return `столу ${stolNumber}`;
        }
    }

    // Показать запрос на включение уведомлений
    async showPermissionRequest() {
        if (!this.isSupported) {
            return {
                granted: false,
                reason: 'Браузер не поддерживает уведомления'
            };
        }

        if (this.isIOS && !this.isStandalone) {
            return {
                granted: false,
                reason: 'На iOS уведомления работают только в установленном PWA'
            };
        }

        if (this.permission === 'granted') {
            return {
                granted: true,
                reason: 'Уведомления уже разрешены'
            };
        }

        if (this.permission === 'denied') {
            return {
                granted: false,
                reason: 'Уведомления запрещены. Включите их в настройках браузера.'
            };
        }

        const permission = await this.requestPermission();

        return {
            granted: permission === 'granted',
            reason: permission === 'granted'
                ? 'Уведомления включены'
                : 'Уведомления отклонены пользователем'
        };
    }

    // Тестовое уведомление
    showTestNotification() {
        return this.showNotification(
            'Тест уведомлений',
            'Уведомления работают корректно! Вы получите уведомление, когда будет вызван ваш талон.',
            {
                tag: 'test-notification',
                requireInteraction: false
            }
        );
    }
}

// Создаем единственный экземпляр сервиса
const notificationService = new NotificationService();

export default notificationService;