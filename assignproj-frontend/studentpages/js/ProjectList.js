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


    // Fetch user info to display name
    loadUserInfo(token);

    // Fetch and display projects
    fetchProjects();
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

// Function to fetch projects from API
async function fetchProjects() {
    try {
        const response = await fetch('http://localhost:5000/api/projects', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            displayProjects(result.data);
        } else {
            console.error('Failed to fetch projects:', result.message);
            displayError('Failed to load projects. Please try again later.');
        }
    } catch (error) {
        console.error('Error fetching projects:', error);
        displayError('Cannot connect to server. Please check your connection.');
    }
}

// Function to display projects
function displayProjects(projects) {
    const container = document.getElementById('projects-main-container');
    container.innerHTML = ''; // Clear existing content

    if (projects.length === 0) {
        container.innerHTML = '<p class="no-projects-message">No projects available.</p>';
        return;
    }

    // Create project cards
    projects.forEach(project => {
        // Create project element
        const projectElement = document.createElement('div');
        projectElement.className = 'project-item';
        projectElement.id = `project-${project.id}`;
        projectElement.onclick = () => window.location.href = `./ProjectDetailsPage.html?id=${project.id}`;

        // Format deadline date
        const deadlineDate = new Date(project.deadline);
        const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Set HTML content
        projectElement.innerHTML = `
<div class="project-header">
<h3 class="project-title">${project.title}</h3>
</div>

<div class="project-description">
<p>${project.description}</p>
</div>
<div class="project-team" id="team-${project.id}">
<!-- Team members will be added here -->
</div>
<span class="project-deadline">${formattedDeadline}</span>
`;

        // Add to container
        container.appendChild(projectElement);

        // Fetch and display team members for this project
        fetchProjectTeam(project.id);
    });
}

// Function to fetch team members for a project
async function fetchProjectTeam(projectId) {
    console.log(`Fetching team for project ${projectId}`);
    try {
        const response = await fetch(`http://localhost:5000/api/projects/${projectId}/groups`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Team data:', result);

        if (result.success) {
            displayTeamMembers(projectId, result.data);
        } else {
            console.error('Failed to fetch team members:', result.message);
        }
    } catch (error) {
        console.error('Error fetching team members:', error);
    }
}

// Function to display team members
function displayTeamMembers(projectId, groups) {
    console.log(`Displaying team members for project ${projectId}:`, groups);
    const teamContainer = document.getElementById(`team-${projectId}`);
    if (!teamContainer) {
        console.error(`Team container for project ${projectId} not found!`);
        return;
    }

    teamContainer.innerHTML = ''; // Clear existing content

    // Process each group
    groups.forEach(group => {
        // Add team leader
        if (group.teamLeader) {
            addTeamAvatar(teamContainer, group.teamLeader.username);
        }

        // Check for GroupMembers property (could be in different casings)
        const groupMembers = group.GroupMembers || group.groupMembers || [];

        if (Array.isArray(groupMembers) && groupMembers.length > 0) {
            groupMembers.forEach(member => {
                // Check if member has User property
                if (member.User) {
                    addTeamAvatar(teamContainer, member.User.username);
                } else {
                    // If member structure is different, try to get username directly
                    const username = member.username || member.user?.username;
                    if (username) {
                        addTeamAvatar(teamContainer, username);
                    }
                }
            });
        }
    });
}

// Function to add team avatar
function addTeamAvatar(container, username) {
    // Skip if username is missing or undefined
    if (!username) {
        console.warn('Skipping avatar creation for undefined username');
        return;
    }

    // Check if this user avatar already exists to avoid duplicates
    const existingAvatars = container.querySelectorAll('.team-avatar');
    for (let i = 0; i < existingAvatars.length; i++) {
        if (existingAvatars[i].textContent === getInitials(username)) {
            return; // Skip if already added
        }
    }

    const avatar = document.createElement('div');
    avatar.className = 'team-avatar';
    avatar.textContent = getInitials(username);
    container.appendChild(avatar);
}

// Helper function to get initials from username
function getInitials(username) {
    if (!username) return '';
    return username.split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .join('');
}

// Function to display error message
function displayError(message) {
    const container = document.getElementById('projects-main-container');
    container.innerHTML = `<div class="error-message">${message}</div>`;
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