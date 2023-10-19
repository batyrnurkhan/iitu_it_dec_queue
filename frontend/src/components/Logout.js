import React, { useEffect } from 'react';

function Logout() {
    useEffect(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
    }, []);

    return (
        <div>
            Logging out...
        </div>
    );
}

export default Logout;