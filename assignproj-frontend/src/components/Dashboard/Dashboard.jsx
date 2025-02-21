import React from 'react';

const Dashboard = ({ username }) => {
  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <h1>Welcome to Dashboard</h1>
      <p>You are logged in as: {username}</p>
    </div>
  );
};

export default Dashboard;