import axios from 'axios';

import { config } from './config';

const axiosInstance = axios.create({
    baseURL: config.logErrorUrl,
});


axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.response.status >= 400 && error.response.status < 600) {
            // Redirect to error page
            window.location.href = '/error';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
