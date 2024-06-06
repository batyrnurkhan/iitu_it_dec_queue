import React, { useEffect } from 'react';
import {config} from "../config";

function Logout() {
    useEffect(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = config.logoutRedirectUrl;
    }, []);

    return (
        <div>
            Logging out...
        </div>
    );
}

export default Logout;