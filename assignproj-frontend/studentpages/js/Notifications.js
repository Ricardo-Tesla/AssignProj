// API Base URL - using your port 5000
const API_BASE_URL = 'http://localhost:5000';

// Main JavaScript file for frontend integration with backend API
document.addEventListener('DOMContentLoaded', function () {
    // Check if user is logged in (token exists)
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../authentication/LoginPage.html'; // Redirect to login if no token
        return;
    }

    // Set up logout button using class selector
    const logoutBtn = document.querySelector('.sidebar-logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('token');
            window.location.href = '../../authentication/LoginPage.html';
        });
    } else {
        console.error("Logout button not found in the HTML");
    }


    // Load user info
    loadUserInfo(token);
    // Fetch notifications immediately when page loads
    fetchNotifications();


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

// Frontend Fetch Function (modified)
const fetchNotifications = async () => {
    try {
        const notificationsResponse = await fetch(`${API_BASE_URL}/api/notifications`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!notificationsResponse.ok) {
            const errorText = await notificationsResponse.text();
            console.error('Full error response:', errorText);
            throw new Error('Failed to fetch notifications');
        }

        const responseData = await notificationsResponse.json();
        console.log('Complete Response Data:', JSON.stringify(responseData, null, 2));

        const { data: notifications } = responseData;
        console.log('Notifications Array:', JSON.stringify(notifications, null, 2));

        const notificationsContainer = document.getElementById('notifications-container');
        const noNotificationsMessage = document.getElementById('no-notifications');

        notificationsContainer.innerHTML = '';

        if (!notifications || notifications.length === 0) {
            noNotificationsMessage.style.display = 'block';
            return;
        }

        noNotificationsMessage.style.display = 'none';

        // Use the displayNotification function for each notification
        notifications.forEach(notification => {
            displayNotification(notification);
        });
    } catch (error) {
        console.error('Complete Notification Fetch Error:', error);
    }
};

async function displayNotification(notification) {
    console.log('Notification object:', notification); // Log the notification object

    const notificationsContainer = document.getElementById('notifications-container');
    const noNotificationsMessage = document.getElementById('no-notifications');

    if (noNotificationsMessage) {
        noNotificationsMessage.style.display = 'none';
    }

    // Create a new notification row
    const notificationRow = document.createElement('div');
    notificationRow.classList.add('table-row');

    // Extract group details
    const groupName = notification.group?.name || notification.task?.group?.name || 'N/A';

    // Fetch project name if not available
    let projectName = 'N/A';
    const projectId = notification.group?.projectId || notification.task?.group?.projectId;

    if (projectId) {
        try {
            console.log('Fetching project name for projectId:', projectId); // Log the projectId
            const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const projectData = await response.json();
                console.log('Project data:', projectData); // Log the project data
                projectName = projectData.data?.title || 'N/A'; // Use the title field
            } else {
                console.error('Failed to fetch project name:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching project name:', error);
        }
    }

    // Format the date
    const formattedDate = notification.createdAt
        ? new Date(notification.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'N/A';

    // Populate the notification row
    notificationRow.innerHTML = `
         <div class="col-message">${notification.message || 'N/A'}</div>
         <div class="col-project">${projectName}</div>
         <div class="col-group">${groupName}</div>
         <div class="col-time">
             <span class="timestamp">${formattedDate}</span>
         </div>
     `;

    // Append the notification row to the container
    notificationsContainer.appendChild(notificationRow);
}


// Sidebar Management
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const toggleIcon = document.getElementById('toggle-icon');

// Toggle Mobile Menu
mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Toggle Desktop Sidebar
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