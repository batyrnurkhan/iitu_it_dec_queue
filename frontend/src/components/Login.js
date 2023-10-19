import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (event) => {
        event.preventDefault();
    
        axios.post('http://localhost:8000/login/', {
            username: username,
            password: password,
        })
        .then((response) => {
            localStorage.setItem('access_token', response.data.token);
            navigate('/profile');
        })
        .catch((error) => {
            console.error("There was an error during the login process:", error);
        });
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;
