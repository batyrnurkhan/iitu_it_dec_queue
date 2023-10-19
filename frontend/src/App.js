import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Profile from './components/Profile';
import HomePage from './components/HomePage';
import QueueSelection from './components/QueueSelection';
import QueuesPage from './components/QueuesPage';
import JoinQueuePage from './components/JoinQueuePage';
import ManagerWorkplace from './components/ManagerWorkplace';


function App() {
    return (
        <Router>
            <div className="App">
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/select-queue" element={<QueueSelection />} />
                    <Route path="/queues" element={<QueuesPage />} />
                    <Route path="/join-queue" element={<JoinQueuePage />} />
                    <Route path="/manager-workplace" element={<ManagerWorkplace />} />
                    <Route path="/" exact element={<QueuesPage/>} /> 
                </Routes>
            </div>
        </Router>
    );
}

export default App;
