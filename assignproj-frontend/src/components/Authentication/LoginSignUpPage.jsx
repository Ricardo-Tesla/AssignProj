import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Authentication/LoginSignUpPage.css';

const LoginSignup = () => {
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [signupData, setSignupData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                // Navigate to dashboard
                navigate('/dashboard');
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Failed to connect to server');
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(signupData),
            });

            const data = await response.json();

            if (data.success) {
                // Switch to login form after successful registration
                setIsActive(false);
                setError('Registration successful! You can now login.');
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Failed to connect to server');
        }
    };

    const toggleActive = (e) => {
        e.preventDefault();
        setIsActive(!isActive);
        setError('');
    };

    return (
        <div className="auth-container">
            <div className={`wrapper ${isActive ? 'active' : ''}`}>
                <span className="bg-animate"></span>

                <div className="form-box login">
                    <h2>Login</h2>
                    {error && <p className='success-signup' >{error}</p>}
                    <form onSubmit={handleLogin}>
                        <div className="input-box">
                            <input
                                type="text"
                                required
                                value={loginData.username}
                                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                            />
                            <label>Username</label>
                            <i className='bx bxs-user'></i>
                        </div>

                        <div className="input-box">
                            <input
                                type="password"
                                required
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            />
                            <label>Password</label>
                            <i className='bx bxs-lock-alt'></i>
                        </div>

                        <button type="submit" className="btn">Login</button>

                        <div className="logreg-link">
                            <p>Don't have an account? <button onClick={toggleActive} className="signup-link">Sign Up</button></p>
                        </div>
                    </form>
                </div>

                <div className="form-box signup">
                    <h2>Sign Up</h2>
                    {error && <p className='failed-signup'>{error}</p>}
                    <form onSubmit={handleSignup}>
                        <div className="input-box">
                            <input
                                type="text"
                                required
                                value={signupData.username}
                                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                            />
                            <label>Username</label>
                            <i className='bx bxs-user'></i>
                        </div>

                        <div className="input-box">
                            <input
                                type="password"
                                required
                                value={signupData.password}
                                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                            />
                            <label>Password</label>
                            <i className='bx bxs-lock-alt'></i>
                        </div>

                        <button type="submit" className="btn">Sign Up</button>

                        <div className="logreg-link">
                            <p>Already have an account? <button onClick={toggleActive} className="login-link">Login</button></p>
                        </div>
                    </form>
                </div>

                <div className="info-text login">
                    <h2>Welcome Back!</h2>
                    <p>Enter your personal details and start journey with us</p>
                </div>

                <div className="info-text signup">
                    <h2>Create Account</h2>
                    <p>Join us today and discover amazing opportunities!</p>
                </div>
            </div>
        </div>
    );
};

export default LoginSignup;