// services/NotificationService.js

class NotificationService {
    constructor() {
        this.permission = Notification.permission;
        this.isSupported = 'Notification' in window;
        this.userTicketInfo = null; // Информация о талоне пользователя
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
        // Сохраняем в localStorage для восстановления после перезагрузки
        localStorage.setItem('userTicketInfo', JSON.stringify(ticketInfo));
    }

    // Получение информации о талоне пользователя
    getUserTicketInfo() {
        if (!this.userTicketInfo) {
            const stored = localStorage.getItem('userTicketInfo');
            if (stored) {
                this.userTicketInfo = JSON.parse(stored);
            }
        }
        return this.userTicketInfo;
    }

    // Очистка информации о талоне
    clearUserTicketInfo() {
        this.userTicketInfo = null;
        localStorage.removeItem('userTicketInfo');
    }

    // Отправка уведомления о вызове талона
    showTicketCalledNotification(ticketData) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }

        const userTicket = this.getUserTicketInfo();

        // Проверяем, наш ли это талон
        if (!userTicket || !this.isOurTicket(ticketData, userTicket)) {
            return;
        }

        const title = '🔔 Ваш талон вызван!';
        const body = `${ticketData.full_name}, подойдите к ${this.getLocationText(ticketData.manager_username)}`;

        const options = {
            body: body,
            icon: '/static/logo.png', // Путь к иконке
            badge: '/static/logo.png',
            image: '/static/notification-banner.png', // Можно добавить баннер
            tag: 'ticket-called', // Уникальный тег для замены старых уведомлений
            requireInteraction: true, // Уведомление не исчезнет автоматически
            vibrate: [200, 100, 200], // Вибрация на мобильных устройствах
            actions: [
                {
                    action: 'view',
                    title: 'Посмотреть талон'
                },
                {
                    action: 'close',
                    title: 'Закрыть'
                }
            ],
            data: {
                ticketId: ticketData.ticket_id,
                ticketNumber: ticketData.ticket_number,
                fullName: ticketData.full_name,
                queueType: ticketData.queue_type,
                managerUsername: ticketData.manager_username,
                timestamp: new Date().toISOString()
            }
        };

        try {
            const notification = new Notification(title, options);

            // Обработчики событий
            notification.onclick = () => {
                window.focus(); // Фокус на окне браузера
                notification.close();

                // Перенаправляем на страницу талона если не на ней
                if (window.location.pathname !== '/ticket') {
                    window.location.href = '/ticket';
                }
            };

            notification.onshow = () => {
                console.log('Notification shown');
                // Автозакрытие через 10 секунд (если requireInteraction: false)
                setTimeout(() => {
                    notification.close();
                }, 10000);
            };

            notification.onclose = () => {
                console.log('Notification closed');
            };

            notification.onerror = (error) => {
                console.error('Notification error:', error);
            };

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    // Отправка общего уведомления
    showNotification(title, message, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
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