const API_BASE_URL = 'http://localhost:5000';
let currentUser = null;
let selectedGroupId = null;

// Main initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in (token exists)
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../authentication/LoginPage.html'; // Redirect to login if no token
        return;
    }

    // Get DOM elements
    const groupSelect = document.getElementById('group-select');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // Set up logout button
    const logoutBtn = document.querySelector('.sidebar-logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error("Logout button not found in the HTML");
    }

    // Event listeners
    groupSelect.addEventListener('change', (e) => {
        selectedGroupId = e.target.value;
        if (selectedGroupId) loadMessages(token, messagesContainer, selectedGroupId);
    });

    sendButton.addEventListener('click', () => sendMessage(token, messageInput, selectedGroupId));

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(token, messageInput, selectedGroupId);
        }
    });

    // Initial load
    await loadUserGroups(token, groupSelect);
    await loadUserInfo(token);
});

// Function to fetch and display user info
async function loadUserInfo(token) {
    try {
        const response = await fetch('http://localhost:5000/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user information');
        }

        const userData = await response.json();

        // Update user name in the sidebar
        if (userData.success && userData.data) {
            document.getElementById('user-name').textContent = userData.data.username;
        } else {
            document.getElementById('user-name').textContent = 'User';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('user-name').textContent = 'User';
    }
}

// Create message element
function createMessageElement(content, isCurrentUser, sender, timestamp) {
    const displayName = isCurrentUser ? 'You' : sender;
    console.log(`Creating message element: displayName=${displayName}, content=${content}`); // Debugging log

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-card ${isCurrentUser ? 'current-user' : ''}`;

    const timeString = new Date(timestamp).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${displayName}</span>
            <span class="message-time">${timeString}</span>
        </div>
        <p class="message-content">${content}</p>
    `;

    return messageDiv;
}

// Load user's groups and populate dropdown
async function loadUserGroups(token, groupSelect) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/groups`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load groups');

        const { data: groups } = await response.json();
        groupSelect.innerHTML = '<option value="">-- Select a Group --</option>';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading groups:', error);
        alert('Failed to load groups');
    }
}

// Send message
async function sendMessage(token, messageInput, selectedGroupId) {
    const messageText = messageInput.value.trim();
    if (!messageText || !selectedGroupId) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/groups/${selectedGroupId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: messageText })
            }
        );

        if (!response.ok) throw new Error('Failed to send message');

        messageInput.value = '';
        loadMessages(token, messagesContainer, selectedGroupId); // Refresh messages after sending
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

// Load messages for the selected group
async function loadMessages(token, messagesContainer, selectedGroupId) {
    if (!selectedGroupId) return;

    try {
        // Clear previous messages
        messagesContainer.innerHTML = '';

        // Show loading indicator
        messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';

        // First, ensure we have the current user's information
        if (!currentUser) {
            try {
                const userResponse = await fetch(`${API_BASE_URL}/api/user`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    currentUser = userData.data;

                } else {
                    throw new Error('Failed to get user profile');
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
            }
        }

        // Fetch messages from the API
        const response = await fetch(
            `${API_BASE_URL}/api/groups/${selectedGroupId}/messages?limit=50`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) throw new Error('Failed to load messages');

        const { success, data: messages } = await response.json();

        if (!success) throw new Error('Failed to load messages');

        // Clear loading indicator
        messagesContainer.innerHTML = '';

        // Display messages
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
        } else {
            // Sort messages by timestamp (newest last)
            const sortedMessages = [...messages].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            // Log data to help debug
            console.log('Current user:', currentUser);
            console.log('Messages:', sortedMessages);

            sortedMessages.forEach(message => {
                const isCurrentUser = currentUser && currentUser.id === message.senderId;
                console.log(`Message from ${message.sender.username}, isCurrentUser: ${isCurrentUser}`); // Debugging log

                const messageElement = createMessageElement(
                    message.content,
                    isCurrentUser,
                    message.sender.username,
                    message.timestamp
                );

                messagesContainer.appendChild(messageElement);
            });

            // Scroll to the bottom of the messages container
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContainer.innerHTML = '<div class="error">Failed to load messages. Please try again.</div>';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    window.location.href = '../../authentication/LoginPage.html';
}








// Sidebar Toggle Functionality
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const toggleIcon = document.getElementById('toggle-icon');

// Mobile Menu Toggle
mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Desktop Collapse Toggle
const handleSidebarToggle = () => {
    sidebar.classList.toggle('collapsed');

    if (sidebar.classList.contains('collapsed')) {
        toggleIcon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        document.querySelector('section').style.marginLeft = '10px';
        document.querySelector('section').style.maxWidth = 'calc(100% - 70px)';
    } else {
        toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        document.querySelector('section').style.marginLeft = '20px';
        document.querySelector('section').style.maxWidth = 'calc(100% - 270px)';
    }
};

// Window Resize Handler
const handleResize = () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
        toggleSidebar.style.display = 'block';
    } else {
        toggleSidebar.style.display = 'none';
    }
};

// Event Listeners
toggleSidebar.addEventListener('click', handleSidebarToggle);
window.addEventListener('resize', handleResize);
document.addEventListener('DOMContentLoaded', handleResize);

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        e.target !== mobileMenuToggle &&
        sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
});