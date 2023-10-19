import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Profile from './components/Profile';
import HomePage from './components/HomePage';

import QueuesPage from './components/QueuesPage';
import JoinQueuePage from './components/JoinQueuePage';

function App() {
  return (
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/home" element={<HomePage />} />

            <Route path="/queues" element={<QueuesPage />} />
            <Route path="/join-queue" element={<JoinQueuePage />} />

            <Route path="/" exact element={<QueuesPage/>} />
          </Routes>
        </div>
      </Router>
  );
}

export default App;