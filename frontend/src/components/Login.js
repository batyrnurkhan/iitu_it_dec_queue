import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import {config} from "../config";
function Login() {
    document.title = "LOGIN"

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

     const handleSubmit = (event) => {
        event.preventDefault();

        axios.post(config.loginUrl, {
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
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    className="login-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                />
                <input
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <button type="submit" className="login-button">Login</button>
            </form>
        </div>
    );
}

export default Login;