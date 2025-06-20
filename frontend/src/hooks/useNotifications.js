// hooks/useNotifications.js

import { useState, useEffect, useCallback } from 'react';
import notificationService from '../services/NotificationService';

export const useNotifications = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState('default');
    const [isEnabled, setIsEnabled] = useState(false);

    // Проверяем поддержку и статус при инициализации
    useEffect(() => {
        const supported = notificationService.isNotificationSupported();
        const currentPermission = notificationService.getPermissionStatus();

        setIsSupported(supported);
        setPermission(currentPermission);
        setIsEnabled(currentPermission === 'granted');
    }, []);

    // Запрос разрешения на уведомления
    const requestPermission = useCallback(async () => {
        try {
            const result = await notificationService.showPermissionRequest();
            setPermission(result.granted ? 'granted' : 'denied');
            setIsEnabled(result.granted);
            return result;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return { granted: false, reason: 'Ошибка при запросе разрешений' };
        }
    }, []);

    // Показать уведомление о вызове талона
    const showTicketCalledNotification = useCallback((ticketData) => {
        if (!isEnabled) {
            console.warn('Notifications are not enabled');
            return null;
        }
        return notificationService.showTicketCalledNotification(ticketData);
    }, [isEnabled]);

    // Показать обычное уведомление
    const showNotification = useCallback((title, message, options = {}) => {
        if (!isEnabled) {
            console.warn('Notifications are not enabled');
            return null;
        }
        return notificationService.showNotification(title, message, options);
    }, [isEnabled]);

    // Показать тестовое уведомление
    const showTestNotification = useCallback(() => {
        if (!isEnabled) {
            console.warn('Notifications are not enabled');
            return null;
        }
        return notificationService.showTestNotification();
    }, [isEnabled]);

    // Установить информацию о талоне пользователя
    const setUserTicketInfo = useCallback((ticketInfo) => {
        notificationService.setUserTicketInfo(ticketInfo);
    }, []);

    // Получить информацию о талоне пользователя
    const getUserTicketInfo = useCallback(() => {
        return notificationService.getUserTicketInfo();
    }, []);

    // Очистить информацию о талоне пользователя
    const clearUserTicketInfo = useCallback(() => {
        notificationService.clearUserTicketInfo();
    }, []);

    // Проверить, является ли талон нашим
    const isOurTicket = useCallback((ticketData) => {
        const userTicket = getUserTicketInfo();
        if (!userTicket) return false;
        return notificationService.isOurTicket(ticketData, userTicket);
    }, [getUserTicketInfo]);

    return {
        // Статус
        isSupported,
        permission,
        isEnabled,

        // Методы
        requestPermission,
        showTicketCalledNotification,
        showNotification,
        showTestNotification,
        setUserTicketInfo,
        getUserTicketInfo,
        clearUserTicketInfo,
        isOurTicket,

        // Вспомогательные свойства
        canShowNotifications: isSupported && isEnabled,
        needsPermission: isSupported && permission === 'default',
        isBlocked: permission === 'denied'
    };
};