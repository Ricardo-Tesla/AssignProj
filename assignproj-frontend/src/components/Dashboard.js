import React, { useEffect, useState } from 'react';

function Dashboard({ user, setIsAuthenticated }) {
  const [protectedData, setProtectedData] = useState('');

  useEffect(() => {
    const fetchProtectedData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/protected', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setProtectedData(data.message);
      } catch (err) {
        console.error('Error fetching protected data:', err);
      }
    };

    fetchProtectedData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-96">
      <h2 className="text-2xl font-bold mb-6">Welcome, {user.username}!</h2>
      <p className="mb-4">{protectedData}</p>
      <button
        onClick={handleLogout}
        className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;