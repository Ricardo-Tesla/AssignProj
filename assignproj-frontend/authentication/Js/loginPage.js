const wrapper = document.getElementById('formWrapper');
        let isActive = false;

        function toggleActive(event) {
            event.preventDefault();
            isActive = !isActive;
            wrapper.classList.toggle('active');
            clearMessages();
        }

        function clearMessages() {
            document.getElementById('loginMessage').textContent = '';
            document.getElementById('signupMessage').textContent = '';
        }

        async function handleLogin(event) {
            event.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const response = await fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                // In loginForm submit handler
                if (data.success) {
                    localStorage.setItem('token', data.token);

                    // Redirect based on user type
                    if (data.isAdmin) {
                        window.location.href = '../adminpages/ViewProjectDetails.html';
                    } else {
                        window.location.href = '../studentpages/ProjectList.html';
                    }
                }
                else {
                    document.getElementById('loginMessage').textContent = data.message;
                }
            } catch (error) {
                document.getElementById('loginMessage').textContent = 'Failed to connect to server';
            }
        }

        async function handleSignup(event) {
            event.preventDefault();
            const username = document.getElementById('signupUsername').value;
            const password = document.getElementById('signupPassword').value;
            const signupMessage = document.getElementById('signupMessage');
            const loginMessage = document.getElementById('loginMessage');

            // Clear previous messages
            signupMessage.textContent = '';
            signupMessage.classList.remove('failed-signup', 'success-signup');

            try {
                const response = await fetch('http://localhost:5000/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (data.success) {
                    // Switch to login form
                    wrapper.classList.remove('active');

                    // Show success message on login side
                    loginMessage.classList.add('success-signup');
                    loginMessage.textContent = 'Registration successful! You can now login.';

                    // Reset signup form fields
                    document.getElementById('signupUsername').value = '';
                    document.getElementById('signupPassword').value = '';
                } else {
                    // Show error on signup side
                    signupMessage.classList.add('failed-signup');
                    signupMessage.textContent = data.message || 'Registration failed';
                }
            } catch (error) {
                // Show network error on signup side
                signupMessage.classList.add('failed-signup');
                signupMessage.textContent = 'Failed to connect to server';
                console.error('Signup error:', error);
            }
        }

        // Modify login function to clear login message when switching forms
        function toggleActive(event) {
            event.preventDefault();
            isActive = !isActive;
            wrapper.classList.toggle('active');

            // Clear messages when switching forms
            document.getElementById('loginMessage').textContent = '';
            document.getElementById('signupMessage').textContent = '';
        }
        // Add password toggle functionality
        function setupPasswordToggle(passwordInputId, toggleIconId) {
            const passwordInput = document.getElementById(passwordInputId);
            const passwordToggle = document.getElementById(toggleIconId);

            passwordToggle.addEventListener('click', function () {
                // Toggle input type between password and text
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    passwordToggle.classList.replace('bx-hide', 'bx-show');
                } else {
                    passwordInput.type = 'password';
                    passwordToggle.classList.replace('bx-show', 'bx-hide');
                }
            });
        }

        // Setup password toggle for both login and signup forms
        setupPasswordToggle('loginPassword', 'loginPasswordToggle');
        setupPasswordToggle('signupPassword', 'signupPasswordToggle');

        // Event listeners
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        document.getElementById('signupForm').addEventListener('submit', handleSignup);