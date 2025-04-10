const API_BASE_URL = 'http://localhost:5000';

// Function to handle authentication and admin validation
const checkIfAdmin = async () => {
    const token = localStorage.getItem('token');

    // Check if the token exists
    if (!token) {
        console.error('No token found. Redirecting to login.');
        window.location.href = '../../authentication/LoginPage.html';
        return false;
    }

    if (token) {
        await loadUserInfo(token);
    }

    // Check if admin validation has already been done in this session
    if (sessionStorage.getItem('isAdminValidated') === 'true') {
        console.log('Admin already validated in this session.');
        return true;
    }

    try {
        // Fetch user details to validate the token and admin status
        const response = await fetch(`${API_BASE_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const userData = await response.json();

        // Check if the user is an admin
        if (!userData.data || !userData.data.isAdmin) {
            alert('Access denied. Only admins can access this page.');
            window.location.href = '../../authentication/LoginPage.html';
            return false;
        }

        // Mark admin validation as successful for this session
        sessionStorage.setItem('isAdminValidated', 'true');
        console.log('Admin validation successful.');
        return true;
    } catch (error) {
        console.error('Authentication error:', error);

        // Handle invalid or expired token
        localStorage.removeItem('token');
        sessionStorage.removeItem('isAdminValidated');
        window.location.href = '../../authentication/LoginPage.html';
        return false;
    }
};

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

const fetchAndPopulateProjects = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found. User is not authenticated.');
        }

        // Fetch projects from the backend
        const response = await fetch(`${API_BASE_URL}/api/admin/projects`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch projects.');
        }

        // Log the fetched data for debugging
        console.log('Fetched projects:', data.data);

        // Populate the dropdown with the fetched projects
        const projectDropdown = document.getElementById('project-dropdown');
        if (!projectDropdown) {
            throw new Error('Project dropdown element not found.');
        }

        projectDropdown.innerHTML = '<option value="" disabled selected>-- Choose a Project --</option>';

        if (data.data.length === 0) {
            projectDropdown.innerHTML += '<option value="" disabled>No projects available</option>';
            return;
        }

        data.data.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id; // Use project ID as the value
            option.textContent = project.title; // Use project title as the display text
            projectDropdown.appendChild(option);
        });

        console.log('Projects fetched and dropdown populated successfully.');
    } catch (error) {
        console.error('Error fetching projects:', error);
        alert('Failed to fetch projects. Please try again later.');
    }
};

/**
* Fetches groups associated with a project.
* @param {string} projectId - ID of the selected project.
* @returns {Promise<Array>} - Array of group objects.
*/
const fetchGroupsForProject = async (projectId) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found. User is not authenticated.');
        }

        // Fetch groups for the selected project
        const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/groups`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch groups: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch groups.');
        }

        // Return the list of groups
        return data.data;
    } catch (error) {
        console.error('Error fetching groups:', error);
        alert('Failed to fetch groups. Please try again later.');
        return [];
    }
};


// Function to populate groups and members checkboxes
const populateGroupsAndMembers = (groups) => {
    const groupsCheckboxList = document.getElementById('groups-checkbox-list');
    const membersCheckboxList = document.getElementById('members-checkbox-list');

    if (groupsCheckboxList && membersCheckboxList) {
        // Clear previous content
        groupsCheckboxList.innerHTML = '';
        membersCheckboxList.innerHTML = '';

        // Populate groups checkboxes
        groups.forEach(group => {
            const groupCheckbox = document.createElement('label');
            groupCheckbox.innerHTML = `
                <input type="checkbox" value="${group.id}"> ${group.name}
            `;
            groupsCheckboxList.appendChild(groupCheckbox);
        });

        // Populate members checkboxes
        groups.forEach(group => {
            group.GroupMembers.forEach(member => {
                const memberCheckbox = document.createElement('label');
                memberCheckbox.innerHTML = `
                    <input type="checkbox" value="${member.User.id}"> ${member.User.username} (${group.name})
                `;
                membersCheckboxList.appendChild(memberCheckbox);
            });
        });
    }
};


// Function to display groups
const displayGroups = (groups) => {
    const groupList = document.getElementById('group-list');
    if (!groupList) {
        console.error('Group list element not found.');
        return;
    }

    // Clear previous content
    groupList.innerHTML = '';

    if (groups.length === 0) {
        groupList.innerHTML = '<p>No groups found for this project.</p>';
        return;
    }

    // Add a heading
    const heading = document.createElement('h3');
    heading.textContent = 'Groups';
    groupList.appendChild(heading);

    // Create a card for each group
    groups.forEach(group => {
        const groupCard = document.createElement('div');
        groupCard.className = 'group-card';

        // Group name
        const groupName = document.createElement('h4');
        groupName.textContent = group.name;
        groupCard.appendChild(groupName);

        // Team leader
        const teamLeader = document.createElement('div');
        teamLeader.className = 'team-leader';
        teamLeader.innerHTML = `<strong>Team Leader:</strong> ${group.teamLeader ? group.teamLeader.username : 'Not assigned'}`;
        groupCard.appendChild(teamLeader);

        // Group members
        const groupMembers = document.createElement('div');
        groupMembers.className = 'group-members';
        groupMembers.innerHTML = `<strong>Members:</strong> ${group.GroupMembers.map(member => member.User.username).join(', ') || 'No members'}`;
        groupCard.appendChild(groupMembers);

        groupList.appendChild(groupCard);
    });

    // Populate groups and members checkboxes
    populateGroupsAndMembers(groups);
};


// Function to set up event listeners
const setupEventListeners = () => {
    console.log('Setting up event listeners...');

    // Add an event listener for the project dropdown
    const projectDropdown = document.getElementById('project-dropdown');
    if (projectDropdown) {
        projectDropdown.addEventListener('change', async (event) => {
            const selectedOption = event.target.options[event.target.selectedIndex]; // Get the selected option
            const selectedProjectId = selectedOption.value; // Get the project ID
            const selectedProjectTitle = selectedOption.textContent; // Get the project title

            console.log(`Selected project ID: ${selectedProjectId}`);
            console.log(`Selected project title: ${selectedProjectTitle}`);

            // Display the selected project title
            const projectDetails = document.getElementById('project-details');
            if (projectDetails) {
                projectDetails.innerHTML = `
                    <h3>Selected Project</h3>
                    <p>${selectedProjectTitle}</p>
                `;
            } else {
                console.error('Project details element not found.');
            }

            // Fetch and display groups for the selected project
            const groups = await fetchGroupsForProject(selectedProjectId);
            displayGroups(groups);
        });
    }

    // Add an event listener for the logout button
    const logoutButton = document.querySelector('.sidebar-logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log('Logging out...');
            localStorage.removeItem('token');
            sessionStorage.removeItem('isAdminValidated');
            window.location.href = '../../authentication/LoginPage.html';
        });
    }

    // Event listener for notification type change
    const notificationType = document.getElementById('notification-type');
    if (notificationType) {
        notificationType.addEventListener('change', (event) => {
            const selectedType = event.target.value;

            // Show/hide specific sections based on the selected type
            document.getElementById('specific-groups-section').style.display =
                selectedType === 'specific-groups' ? 'block' : 'none';
            document.getElementById('specific-members-section').style.display =
                selectedType === 'specific-members' ? 'block' : 'none';
        });
    }

    // Event listener for notification form submission
    const notificationForm = document.getElementById('send-notification-form');
    if (notificationForm) {
        notificationForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const projectId = document.getElementById('project-dropdown').value;
            const notificationType = document.getElementById('notification-type').value;
            const message = document.getElementById('notification-message').value;

            if (!projectId || !notificationType || !message) {
                alert('Please fill out all fields.');
                return;
            }

            try {
                let responses = [];

                if (notificationType === 'all-groups') {
                    // Send notification to all groups under the project
                    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/notifications`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ message })
                    });

                    // Push the single response into an array for consistency
                    responses.push(response);
                } else if (notificationType === 'specific-groups') {
                    // Send notification to specific groups
                    const selectedGroups = Array.from(document.querySelectorAll('#groups-checkbox-list input:checked'))
                        .map(checkbox => checkbox.value);

                    console.log('Selected Groups:', selectedGroups); // Debugging
                    if (selectedGroups.length === 0) {
                        alert('Please select at least one group.');
                        return;
                    }

                    // Send notifications to each selected group
                    responses = await Promise.all(selectedGroups.map(groupId =>
                        fetch(`${API_BASE_URL}/api/projects/${projectId}/groups/${groupId}/notifications`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ message })
                        })
                    ));
                } else if (notificationType === 'specific-members') {
                    // Send notification to specific members
                    const selectedMembers = Array.from(document.querySelectorAll('#members-checkbox-list input:checked'))
                        .map(checkbox => checkbox.value);

                    console.log('Selected Members:', selectedMembers); // Debugging
                    if (selectedMembers.length === 0) {
                        alert('Please select at least one member.');
                        return;
                    }

                    // Send notifications to each selected member
                    responses = await Promise.all(selectedMembers.map(userId =>
                        fetch(`${API_BASE_URL}/api/projects/${projectId}/users/${userId}/notifications`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ message })
                        })
                    ));
                }

                // Log all responses for debugging
                console.log('Notification Responses:', responses);

                // Check if all responses are successful
                const allSuccessful = responses.every(response => response.ok);

                if (allSuccessful) {
                    alert('Notification sent successfully!');
                    notificationForm.reset();
                } else {
                    // Log failed responses for debugging
                    const failedResponses = await Promise.all(responses.map(async (response) => {
                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Failed Response:', {
                                status: response.status,
                                statusText: response.statusText,
                                errorData
                            });
                            return { status: response.status, errorData };
                        }
                    }));
                    console.error('Failed Responses:', failedResponses);
                    throw new Error('Failed to send one or more notifications.');
                }
            } catch (error) {
                console.error('Error sending notification:', error);
                alert('Failed to send notification. Please try again later.');
            }
        });
    }
};


const fetchNotificationsHistory = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sent-notifications`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch notifications history');
        }

        const data = await response.json();
        const notificationsTableBody = document.getElementById('notifications-table-body');
        notificationsTableBody.innerHTML = '';

        if (data.count === 0) {
            notificationsTableBody.innerHTML = `
                        <tr>
                            <td colspan="3">
                                No notifications history found.
                            </td>
                        </tr>
                    `;
            return;
        }

        data.data.forEach((notification) => {
            const row = document.createElement('tr');

            // Format the date
            const formattedDate = new Date(notification.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });

            // Handle Recipient
            const recipientName = notification.Recipient
                ? notification.Recipient.username
                : 'N/A';

            row.innerHTML = `
                        <td>${formattedDate}</td>
                        <td>${notification.message}</td>
                        <td>${recipientName}</td>
                    `;

            notificationsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching notifications history:', error);
        const notificationsTableBody = document.getElementById('notifications-table-body');
        notificationsTableBody.innerHTML = `
                    <tr>
                        <td colspan="3">
                            Failed to load notifications. ${error.message}
                        </td>
                    </tr>
                `;
    }
};




// Call the function when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticatedAndAdmin = await checkIfAdmin();

    if (!isAuthenticatedAndAdmin) {
        console.error('User is not authenticated or not an admin. Redirecting...');
        return;
    }

    // Proceed with page-specific logic if the user is authenticated and an admin
    console.log('User is authenticated and an admin. Proceeding with page setup...');

    // Set up event listeners
    setupEventListeners();

    // Fetch and populate projects in the dropdown
    await fetchAndPopulateProjects();

    // Fetch notifications history
    await fetchNotificationsHistory();


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