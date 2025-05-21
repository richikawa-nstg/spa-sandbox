import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import MapPage from './pages/MapPage';  // 追加
import Header from './components/Header';

function App() {
  return (
    <Router>
      <div className="container py-3">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/map" element={<MapPage />} />  {/* 追加 */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
