import React, { useEffect } from 'react';
import axiosInstance from '../axiosInstance';
import { config } from '../config';
import '../styles/ErrorPage.css';

const ErrorPage = () => {
    document.title = "ERROR"
    useEffect(() => {
        // Log the error to the server when the component mounts
        axiosInstance.post(config.logErrorUrl, { message: 'An error occurred and the user was redirected to the error page' })
            .then(response => {
                console.log('Error logged successfully:', response.data);
            })
            .catch(error => {
                console.error('Error logging the message:', error);
            });
    }, []);

    return (
        <div className="error-page-container">
            <h1>ОШИБКА!!!</h1>
            <p>ОБРАТИТЕСЬ К РАЗРАБОТЧИКУ</p>
            <a href="/join-queue/">ВЕРНУТЬСЯ В ОЧЕРЕДЬ</a>
        </div>
    );
};

export default ErrorPage;
