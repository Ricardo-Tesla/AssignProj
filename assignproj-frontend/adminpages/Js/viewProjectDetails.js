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

// Render projects and groups
function renderProjects(projects) {
    const container = document.getElementById('project-container'); // Corrected ID

    if (!projects || projects.length === 0) {
        container.innerHTML = `
    <div class="project-info">
        <h2>No Projects Found</h2>
        <p>Create a new project to get started.</p>
    </div>
`;
        return;
    }

    container.innerHTML = projects.map(project => `
<div class="project-info">
    <h2>${project.title}</h2>
    <p class="description"><strong>Description:</strong> ${project.description}</p>
    <p class="deadline"><strong>Deadline:</strong> ${new Date(project.deadline).toLocaleDateString()}</p>
    <div class="groups-section">
        <h3>Groups</h3>
        <table class="groups-table">
            <thead>
                <tr>
                    <th>Group Name</th>
                    <th>Members</th>
                    <th>Leader</th>
                </tr>
            </thead>
            <tbody id="groups-${project.id}">
                <tr>
                    <td colspan="3">Loading groups...</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
`).join('');

    // Load groups for each project
    projects.forEach(loadGroups);
}

// Fetch and display projects
async function loadProjects() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const projectsRes = await fetch(`${API_BASE_URL}/api/admin/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!projectsRes.ok) {
            throw new Error(`API error: ${projectsRes.status}`);
        }

        const projectsData = await projectsRes.json();
        renderProjects(projectsData.data || projectsData); // Handle both response formats
    } catch (error) {
        console.error('Error loading projects:', error);
        const container = document.getElementById('project-container'); // Corrected ID
        container.innerHTML = `
    <div class="project-info">
        <h2>Error Loading Projects</h2>
        <p>${error.message}</p>
        <p>Please make sure your backend server is running on port 5000.</p>
    </div>
`;
    }
}

// Fetch and render groups for a project
async function loadGroups(project) {
    try {
        const token = localStorage.getItem('token');
        console.log('Fetching groups for project:', project.id);

        const groupsRes = await fetch(`${API_BASE_URL}/api/projects/${project.id}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Response status:', groupsRes.status);

        if (!groupsRes.ok) {
            throw new Error(`API error: ${groupsRes.status}`);
        }

        const groupsData = await groupsRes.json();
        console.log('Groups data:', groupsData);

        renderGroups(project.id, groupsData.data || groupsData); // Handle both response formats
    } catch (error) {
        console.error(`Error loading groups for project ${project.id}:`, error);
        const tbody = document.getElementById(`groups-${project.id}`);
        tbody.innerHTML = `
                <tr>
                    <td colspan="3">Error loading groups: ${error.message}</td>
                </tr>
            `;
    }
}

// Render groups table
function renderGroups(projectId, groups) {
    const tbody = document.getElementById(`groups-${projectId}`);

    if (!groups || groups.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="3">No groups found for this project</td>
                </tr>
            `;
        return;
    }

    tbody.innerHTML = groups.map(group => {
        const members = group.GroupMembers ?
            group.GroupMembers.map(m => m.User ? m.User.username : m.username).join(', ') :
            (group.members ? group.members.join(', ') : '');

        const leaderName = group.teamLeader ?
            (typeof group.teamLeader === 'object' ? group.teamLeader.username : group.teamLeader) :
            (group.leader || '');

        return `
                <tr>
                    <td>${group.name}</td>
                    <td>${members}</td>
                    <td>${leaderName}</td>
                </tr>
            `;
    }).join('');
}

// Check authentication
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../authentication/LoginPage.html';
        return false;
    }

    try {
        const userRes = await fetch(`${API_BASE_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userRes.ok) {
            throw new Error('Authentication failed');
        }

        return true;
    } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
        window.location.href = '../../authentication/LoginPage.html';
        return false;
    }
}

// Initialize page
async function init() {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        const token = localStorage.getItem('token');
        await loadUserInfo(token);
        await loadProjects();
    }
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

// DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    init();
});