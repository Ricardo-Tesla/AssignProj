// API Base URL
const API_BASE_URL = 'http://localhost:5000';

// Function to fetch and display user info
async function loadUserInfo(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
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
            document.querySelector('.sidebar-user-name').textContent = userData.data.username;
        } else {
            document.querySelector('.sidebar-user-name').textContent = 'User';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        document.querySelector('.sidebar-user-name').textContent = 'User';
    }
}

// Function to set up the project form
function setupProjectForm(token) {
    const projectForm = document.getElementById('projectForm');
    const createButton = document.getElementById('create-groups');

    createButton.addEventListener('click', async () => {
        // Get form values
        const projectTitle = document.getElementById('project-name').value.trim();
        const projectDescription = document.getElementById('project-description').value.trim();
        const projectDeadline = document.getElementById('project-deadline').value;
        const maxStudents = document.getElementById('max-students').value;

        // Validate form inputs
        if (!projectTitle || !projectDescription || !projectDeadline || !maxStudents) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            // Create project data object matching the backend expectations
            const projectData = {
                title: projectTitle,
                description: projectDescription,
                deadline: projectDeadline,
                maxStudents: parseInt(maxStudents, 10)
            };

            // Send request to the backend
            const response = await fetch(`${API_BASE_URL}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(projectData)
            });

            // Parse response
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create project');
            }

            // Show success message
            showNotification('Project created successfully!', 'success');

            // Redirect to groupmembers.html page and pass the project ID
            setTimeout(() => {
                window.location.href = `./groupmembers.html?projectId=${result.data.id}`;
            }, 1500);

        } catch (error) {
            console.error('Project creation error:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    });
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Position the notification
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';

    // Style based on type
    if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
        notification.style.color = 'white';
    } else if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
    } else {
        notification.style.backgroundColor = '#2196F3';
        notification.style.color = 'white';
    }

    // Remove after a delay
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Sidebar functionality
function setupSidebar() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const toggleIcon = document.getElementById('toggle-icon');

    // Logout button functionality
    document.querySelector('.sidebar-logout-button').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '../../authentication/LoginPage.html';
    });

    // Toggle sidebar on mobile
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Update toggle visibility based on screen size
    const updateToggleVisibility = () => {
        if (window.innerWidth > 768) {
            toggleSidebar.style.display = 'block';
        } else {
            toggleSidebar.style.display = 'none';
        }
    };

    updateToggleVisibility();
    window.addEventListener('resize', updateToggleVisibility);

    // Toggle sidebar collapse on desktop
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');

        if (sidebar.classList.contains('collapsed')) {
            toggleIcon.classList.remove('fa-chevron-left');
            toggleIcon.classList.add('fa-chevron-right');
            document.querySelector('section').style.marginLeft = '10px';
            document.querySelector('section').style.maxWidth = 'calc(100% - 70px)';
        } else {
            toggleIcon.classList.remove('fa-chevron-right');
            toggleIcon.classList.add('fa-chevron-left');
            document.querySelector('section').style.marginLeft = '20px';
            document.querySelector('section').style.maxWidth = 'calc(100% - 270px)';
        }
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            e.target !== mobileMenuToggle &&
            sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

// Initialize page
async function init() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../authentication/LoginPage.html';
        return;
    }

    try {
        // Load user info
        await loadUserInfo(token);

        // Set up project form submission
        setupProjectForm(token);
    } catch (error) {
        console.error('Initialization error:', error);
        localStorage.removeItem('token');
        window.location.href = '../../authentication/LoginPage.html';
    }
}

// DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    init();
});