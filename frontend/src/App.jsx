import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DriverPage } from './pages/DriverPage';
import { PassengerPage } from './pages/PassengerPage';
import { AdminPage } from './pages/AdminPage';
import { ChatPage } from './pages/ChatPage';
import { ChatFloatingWidget } from './components/ChatFloatingWidget';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-surface text-ink font-sans flex flex-col antialiased selection:bg-primary selection:text-white">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route
                  path="/driver"
                  element={
                    <ProtectedRoute allowedRole="driver">
                      <DriverPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/passenger"
                  element={
                    <ProtectedRoute allowedRole="passenger">
                      <PassengerPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRole="admin">
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <ChatFloatingWidget />
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
