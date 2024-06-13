import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Profile from './components/Profile';
import HomePage from './components/HomePage';
import { useState } from "react";
import QueuesPage from './components/QueuesPage';
import JoinQueuePage from './components/JoinQueuePage';
import TicketDisplayPage from "./components/TicketDisplayPage";
import ErrorPage from "./components/ErrorPage"; // Import the ErrorPage component
import { AudioContext } from "./context/AudioContext";

function App() {
    const [audioUrl, setAudioUrl] = useState(undefined);
    return (
        <AudioContext.Provider value={{ audioUrl, setAudioUrl }}>
            <Router>
                <div className="App">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/home" element={<HomePage />} />
                        <Route path="/queues" element={<QueuesPage />} />
                        <Route path="/join-queue" element={<JoinQueuePage />} />
                        <Route path="/ticket" element={<TicketDisplayPage />} />
                        <Route path="/error" element={<ErrorPage />} />
                        <Route path="/" exact element={<HomePage />} />
                    </Routes>
                </div>
            </Router>
        </AudioContext.Provider>
    );
}

export default App;
