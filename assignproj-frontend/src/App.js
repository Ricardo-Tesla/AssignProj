import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {!isAuthenticated ? (
        <LoginForm setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
      ) : (
        <Dashboard user={user} setIsAuthenticated={setIsAuthenticated} />
      )}
    </div>
  );
}

export default App;