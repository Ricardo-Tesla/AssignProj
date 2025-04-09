document.addEventListener('DOMContentLoaded', async () => {
    // API Base URL
    const API_BASE_URL = 'http://localhost:5000';

    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
        displayError('No authentication token found. Please log in again.');
        return;
    }
    if (token) {
        await loadUserInfo(token);
    }

    // API request headers
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Add event listener for back button
    document.getElementById('back-to-projects').addEventListener('click', () => {
        document.getElementById('projects-section').style.display = 'block';
        document.getElementById('progress-monitor-container').style.display = 'none';
    });

    // Load projects on initial page load
    loadProjects();

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
                document.querySelector('.sidebar-user-name').textContent = userData.data.username;
            } else {
                document.querySelector('.sidebar-user-name').textContent = 'User';
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            document.querySelector('.sidebar-user-name').textContent = 'User';
        }
    }

    // Function to load projects
    async function loadProjects() {
        try {
            const projectsRes = await fetch(`${API_BASE_URL}/api/admin/projects`, {
                headers
            });

            if (!projectsRes.ok) {
                throw new Error(`API error: ${projectsRes.status}`);
            }

            const projectsData = await projectsRes.json();
            renderProjects(projectsData.data || projectsData);
        } catch (error) {
            console.error('Error loading projects:', error);
            displayError('Failed to load projects. Please try again later.');
        }
    }

    // Function to render projects list
    function renderProjects(projects) {
        const projectsContainer = document.getElementById('projects-container');
        projectsContainer.innerHTML = '';

        if (!projects || projects.length === 0) {
            projectsContainer.innerHTML = '<div class="no-data">No projects found.</div>';
            return;
        }

        projects.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.className = 'project-card';
            projectCard.innerHTML = `
                <h2>${project.title}</h2>
                <p>${project.description || 'No description available'}</p>
                <button class="view-project-btn" data-project-id="${project.id}">View Progress</button>
            `;

            projectsContainer.appendChild(projectCard);
        });

        // Add event listeners to project buttons
        document.querySelectorAll('.view-project-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectId = e.target.getAttribute('data-project-id');
                loadProjectDetails(projectId);
            });
        });
    }

    // Function to load project details and groups
    async function loadProjectDetails(projectId) {
        try {
            // Show loading indicator
            const groupsContainer = document.getElementById('groups-container');
            groupsContainer.innerHTML = '<div class="loading-indicator">Loading project details...</div>';

            // Fetch project details
            const projectRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                headers
            });

            if (!projectRes.ok) {
                throw new Error(`API error: ${projectRes.status}`);
            }

            const projectData = await projectRes.json();

            // Fetch groups for this project
            const groupsRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}/groups`, {
                headers
            });

            if (!groupsRes.ok) {
                throw new Error(`API error: ${groupsRes.status}`);
            }

            const groupsData = await groupsRes.json();

            // Update UI with project title
            document.getElementById('project-title').textContent = `Group Progress`;

            // Switch to progress view
            document.getElementById('projects-section').style.display = 'none';
            document.getElementById('progress-monitor-container').style.display = 'block';

            // Process and display groups
            await processGroups(groupsData.data);

        } catch (error) {
            console.error('Error loading project details:', error);
            displayError(`Failed to load project details: ${error.message}`);
        }
    }

    // Function to process groups and fetch their tasks
    async function processGroups(groups) {
        const groupsContainer = document.getElementById('groups-container');
        groupsContainer.innerHTML = '';

        if (!groups || groups.length === 0) {
            groupsContainer.innerHTML = '<div class="no-data">No groups found for this project.</div>';
            return;
        }

        // Process each group
        for (const group of groups) {
            // Create group element
            const groupElement = document.createElement('div');
            groupElement.className = 'group-progress';
            groupElement.id = `group-${group.id}`;

            // Set group header
            const teamLeader = group.teamLeader ? group.teamLeader.username : 'No leader assigned';
            groupElement.innerHTML = `
                <h2 class="group-title">${group.name}</h2>
                <p class="group-leader">Team Leader: ${teamLeader}</p>
                <div class="loading-indicator">Loading tasks...</div>
                <table class="tasks-table">
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Task</th>
                            <th>Deadline</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody class="group-tasks">
                    </tbody>
                </table>
            `;

            groupsContainer.appendChild(groupElement);

            // Fetch and display tasks for this group
            await fetchGroupTasks(group.id);
        }
    }

    // Function to fetch tasks for a specific group
    async function fetchGroupTasks(groupId) {
        try {
            // Ensure the token is still valid
            const token = localStorage.getItem('token');
            if (!token) {
                displayError('Authentication token is missing. Please log in again.');
                return;
            }

            // Fetch tasks with the correct headers
            const tasksRes = await fetch(`${API_BASE_URL}/api/groups/${groupId}/tasks`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Handle 403 Forbidden error specifically
            if (tasksRes.status === 403) {
                throw new Error('You do not have permission to view these tasks. Please check your access rights.');
            }

            // Handle other API errors
            if (!tasksRes.ok) {
                throw new Error(`API error: ${tasksRes.status}`);
            }

            // Parse and return the tasks data
            const tasksData = await tasksRes.json();
            renderGroupTasks(groupId, tasksData.data);

        } catch (error) {
            console.error(`Error fetching tasks for group ${groupId}:`, error);
            const groupElement = document.getElementById(`group-${groupId}`);
            groupElement.querySelector('.loading-indicator').innerHTML =
                `<div class="error">Failed to load tasks: ${error.message}</div>`;
        }
    }

    // Function to render tasks for a group
    function renderGroupTasks(groupId, tasks) {
        const groupElement = document.getElementById(`group-${groupId}`);
        const loadingIndicator = groupElement.querySelector('.loading-indicator');
        const tasksBody = groupElement.querySelector('.group-tasks');

        // Remove loading indicator
        loadingIndicator.style.display = 'none';

        // Clear any existing tasks
        tasksBody.innerHTML = '';

        if (!tasks || tasks.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="4" class="no-tasks">No tasks assigned to this group</td>';
            tasksBody.appendChild(emptyRow);
            return;
        }

        // Add each task as a row
        tasks.forEach(task => {
            const taskRow = document.createElement('tr');
            taskRow.className = 'task-row';

            // Set status class
            if (task.status === 'completed') {
                taskRow.classList.add('completed');
            } else if (new Date(task.deadline) < new Date() && task.status !== 'completed') {
                taskRow.classList.add('overdue');
            }

            const dueDate = new Date(task.dueDate);
            const formattedDate = dueDate.toLocaleDateString();



            // Determine the color for the task status
            let statusColor = '';
            if (task.status === 'pending') {
                statusColor = 'red';
            } else if (task.status === 'in_progress') {
                statusColor = 'orange';
            } else if (task.status === 'completed') {
                statusColor = 'green';
            }

            // Create row content
            taskRow.innerHTML = `
    <td class="member-name">${task.assignedTo ? task.assignedTo.username : 'Unassigned'}</td>
    <td class="task-description">${task.title}</td>
    <td class="task-deadline">${formattedDate}</td>
    <td class="task-status" style="color: ${statusColor};">${capitalizeFirstLetter(task.status)}</td>
`;

            tasksBody.appendChild(taskRow);
        });
    }

    // Helper function to display errors
    function displayError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()">Retry</button>
        `;

        // Clear and add error message to the active container
        if (document.getElementById('projects-section').style.display !== 'none') {
            const container = document.getElementById('projects-container');
            container.innerHTML = '';
            container.appendChild(errorElement);
        } else {
            const container = document.getElementById('groups-container');
            container.innerHTML = '';
            container.appendChild(errorElement);
        }
    }

    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
});

// Toggle sidebar on mobile
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.getElementById('sidebar');

mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Toggle sidebar collapse on desktop
const toggleSidebar = document.getElementById('toggle-sidebar');
const toggleIcon = document.getElementById('toggle-icon');

const updateToggleVisibility = () => {
    if (window.innerWidth > 768) {
        toggleSidebar.style.display = 'block';
    } else {
        toggleSidebar.style.display = 'none';
    }
};

updateToggleVisibility();
window.addEventListener('resize', updateToggleVisibility);

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