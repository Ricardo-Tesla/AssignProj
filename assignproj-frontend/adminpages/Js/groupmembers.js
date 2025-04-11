document.addEventListener('DOMContentLoaded', async () => {
    // API Base URL - using your port 5000
    const API_BASE_URL = 'http://localhost:5000';

    // Check authentication
    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '../../authentication/LoginPage.html';
            return false;
        }

        if (token) {
            await loadUserInfo(token);
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


    // Load projects function
    const loadProjects = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/admin/projects`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const result = await response.json();

            if (result.success && result.data) {
                const projectSelect = document.getElementById('project-select');

                // Clear existing options except the first one
                while (projectSelect.options.length > 1) {
                    projectSelect.remove(1);
                }

                // Add projects to dropdown using title as display text and id as value
                result.data.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.title; // Display project title
                    projectSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            alert('Failed to load projects. Please try again later.');
        }
    };

    // Function to load groups for a selected project
    const loadGroupsByProject = async (projectId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/groups`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch groups');
            }

            const result = await response.json();

            const tableBody = document.getElementById('groups-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            if (result.success && result.data && result.data.length > 0) {
                result.data.forEach(group => {
                    const row = document.createElement('tr');

                    // Group Name column
                    const nameCell = document.createElement('td');
                    nameCell.textContent = group.name;
                    row.appendChild(nameCell);

                    // Members column
                    const membersCell = document.createElement('td');
                    if (group.GroupMembers && group.GroupMembers.length > 0) {
                        const memberNames = group.GroupMembers.map(member =>
                            member.User ? member.User.username : 'Unknown'
                        ).join(', ');
                        membersCell.textContent = memberNames;
                    } else {
                        membersCell.textContent = 'No members';
                    }
                    row.appendChild(membersCell);

                    // Team Leader column
                    const leaderCell = document.createElement('td');
                    leaderCell.textContent = group.teamLeader ? group.teamLeader.username : 'No leader assigned';
                    row.appendChild(leaderCell);

                    tableBody.appendChild(row);
                });
            } else {
                // If no groups found, display a message in the table
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 3;
                cell.textContent = 'No groups found for this project';
                cell.style.textAlign = 'center';
                row.appendChild(cell);
                tableBody.appendChild(row);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            const tableBody = document.getElementById('groups-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'Error loading groups. Please try again.';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            tableBody.appendChild(row);
        }
    };

    // Function to get the group name input
    const getGroupName = () => {
        const groupNameInput = document.getElementById('group-name');
        return groupNameInput.value.trim();
    };

    // Only proceed if authentication is successful
    if (!(await checkAuth())) return;

    // DOM elements
    const searchInput = document.getElementById('search-members');
    const searchResults = document.getElementById('search-results');
    const selectedMembers = document.getElementById('selected-members');
    const leaderDropdown = document.getElementById('group-leader');

    if (!searchInput || !searchResults || !selectedMembers || !leaderDropdown) {
        console.error('Required DOM elements not found');
        return;
    }

    // Store selected members to prevent duplicates
    const selectedMemberIds = new Set();

    // Function to update team leader dropdown options based on selected members
    const updateLeaderDropdown = () => {
        // Clear current options except the default one
        while (leaderDropdown.options.length > 1) {
            leaderDropdown.remove(1);
        }

        // Get all selected member elements
        const memberElements = selectedMembers.querySelectorAll('.selected-member');

        // If no members are selected, disable the dropdown
        if (memberElements.length === 0) {
            leaderDropdown.disabled = true;
            return;
        }

        // Enable the dropdown
        leaderDropdown.disabled = false;

        // Add each selected member as an option
        memberElements.forEach(memberElement => {
            const userId = memberElement.dataset.userId;
            const username = memberElement.querySelector('span').textContent;

            const option = document.createElement('option');
            option.value = userId;
            option.textContent = username;

            leaderDropdown.appendChild(option);
        });
    };

    // Search function with better error handling
    const searchMembers = async (query) => {
        if (!query || query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        try {
            const token = localStorage.getItem('token');
            console.log(`Searching for: ${query}`);

            const response = await fetch(`${API_BASE_URL}/api/users/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseData = await response.json();
            console.log('Search response:', responseData);

            if (!response.ok) {
                throw new Error(responseData.message || 'Search failed');
            }

            if (responseData.success && responseData.data && responseData.data.length > 0) {
                displaySearchResults(responseData.data);
            } else {
                searchResults.innerHTML = '<div class="no-results">No members found</div>';
                searchResults.style.display = 'block';
            }
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="error">Error searching members</div>';
            searchResults.style.display = 'block';
        }
    };

    // Display search results
    const displaySearchResults = (users) => {
        searchResults.innerHTML = '';
        console.log('Displaying results:', users);

        users.forEach(user => {
            // Skip already selected members
            if (selectedMemberIds.has(user.id)) return;

            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';

            // Format username (capitalize first letter)
            const formattedUsername = user.username.charAt(0).toUpperCase() + user.username.slice(1);
            resultItem.textContent = formattedUsername;

            resultItem.dataset.userId = user.id;
            resultItem.dataset.username = user.username;

            resultItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Selecting user:', user);
                addSelectedMember(user);
                searchResults.style.display = 'none';
                searchInput.value = '';
            });

            searchResults.appendChild(resultItem);
        });

        searchResults.style.display = 'block';
    };

    // Add a selected member
    const addSelectedMember = (user) => {
        if (!user || !user.id || !user.username) {
            console.error('Invalid user data:', user);
            return;
        }

        if (selectedMemberIds.has(user.id)) return;
        console.log('Adding member:', user);

        // Format username (capitalize first letter)
        const formattedUsername = user.username.charAt(0).toUpperCase() + user.username.slice(1);

        const memberElement = document.createElement('div');
        memberElement.className = 'selected-member';
        memberElement.dataset.userId = user.id;

        memberElement.innerHTML = `
    <span>${formattedUsername}</span>
    <button type="button" class="remove-btn">&times;</button>
`;

        const removeBtn = memberElement.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                memberElement.remove();
                selectedMemberIds.delete(user.id);
                console.log('Removed member:', user.id);

                // Update leader dropdown after removing a member
                updateLeaderDropdown();
            });
        }

        selectedMembers.appendChild(memberElement);
        selectedMemberIds.add(user.id);

        // Update leader dropdown after adding a member
        updateLeaderDropdown();
    };

    // Set up event listeners for search
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
            searchMembers(query);
        } else {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Prevent form submission on Enter in search field
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    // Initialize leader dropdown (disabled by default)
    leaderDropdown.disabled = true;

    // Function to get all selected members for form submission
    const getSelectedMembers = () => {
        const members = [];
        selectedMembers.querySelectorAll('.selected-member').forEach(element => {
            members.push({
                id: element.dataset.userId,
                username: element.querySelector('span').textContent
            });
        });
        return members;
    };

    // Function to get the selected leader
    const getSelectedLeader = () => {
        return leaderDropdown.value;
    };

    // Add event listener for the create-group button
    const createGroupButton = document.getElementById('create-group');
    if (createGroupButton) {
        createGroupButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // Get all required values
            const projectSelect = document.getElementById('project-select');
            const projectId = projectSelect.value;
            const projectName = projectSelect.options[projectSelect.selectedIndex].text;
            const groupNameInput = document.getElementById('group-name');
            const groupName = groupNameInput.value.trim();
            const leaderId = getSelectedLeader();
            const leaderName = leaderDropdown.options[leaderDropdown.selectedIndex].text;
            const members = getSelectedMembers();

            // Validate all inputs
            let isValid = true;
            let errorMessage = '';

            // Check project selection
            if (!projectId || projectId === 'choose') {
                isValid = false;
                errorMessage = 'Please select a project';
            }
            // Check group name
            else if (!groupName) {
                isValid = false;
                errorMessage = 'Please enter a group name';
            }
            // Check team leader
            else if (!leaderId || leaderId === 'choose') {
                isValid = false;
                errorMessage = 'Please select a team leader';
            }
            // Check if at least two members are selected
            else if (members.length < 2) {
                isValid = false;
                errorMessage = 'A group must have at least 2 members';
            }

            if (!isValid) {
                alert(errorMessage);
                return;
            }

            // Proceed with advanced validation and group creation logic
            try {
                const token = localStorage.getItem('token');
                

                const projectResponse = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
    
                if (!projectResponse.ok) {
                    throw new Error('Failed to fetch project details');
                }
    
                const projectData = await projectResponse.json();
    
                if (projectData.success && projectData.data) {
                    const maxMembers = projectData.data.maxStudents;
    
                    // Check if the number of selected members exceeds the maximum allowed
                    if (members.length > maxMembers) {
                        alert(`The number of selected members (${members.length}) exceeds the maximum allowed for this project (${maxMembers}). Please reduce the number of members.`);
                        return;
                    }
                } else {
                    throw new Error('Failed to retrieve project details');
                }

                // Fetch existing groups in the project to check for duplicates
                const groupsResponse = await fetch(`${API_BASE_URL}/api/projects/${projectId}/groups`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!groupsResponse.ok) {
                    throw new Error('Failed to fetch project groups for validation');
                }

                const groupsResult = await groupsResponse.json();

                if (groupsResult.success && groupsResult.data) {
                    // Check for duplicate group name
                    const existingGroupWithSameName = groupsResult.data.find(
                        group => group.name.toLowerCase() === groupName.toLowerCase()
                    );

                    if (existingGroupWithSameName) {
                        alert(`A group with the name "${groupName}" already exists in this project. Please choose a different name.`);
                        return;
                    }

                    // Check if any selected member already belongs to another group in this project
                    const memberIds = members.map(member => member.id);
                    const conflictingMembers = [];

                    groupsResult.data.forEach(group => {
                        if (group.GroupMembers && group.GroupMembers.length > 0) {
                            group.GroupMembers.forEach(groupMember => {
                                const userId = groupMember.userId || (groupMember.User ? groupMember.User.id : null);
                                if (userId && memberIds.includes(userId.toString())) {
                                    const memberName = groupMember.User ? groupMember.User.username : 'Unknown';
                                    conflictingMembers.push({
                                        id: userId,
                                        name: memberName,
                                        groupName: group.name
                                    });
                                }
                            });
                        }
                    });

                    if (conflictingMembers.length > 0) {
                        const membersList = conflictingMembers.map(
                            member => `${member.name} (already in group "${member.groupName}")`
                        ).join(', ');

                        alert(`The following members already belong to other groups in this project: ${membersList}`);
                        return;
                    }
                }

                // All validations passed - show confirmation dialog
                // Create confirmation dialog content
                const membersList = members.map(member => member.username).join(', ');

                // Create a custom modal for confirmation
                const confirmationModal = document.createElement('div');
                confirmationModal.className = 'confirmation-modal';
                confirmationModal.innerHTML = `
        <div class="confirmation-content">
            <h3>Confirm Group Creation</h3>
            <p>Please review the group details before confirming:</p>
            
            <div class="group-details">
                <div class="detail-row">
                    <span class="label">Project:</span>
                    <span class="value">${projectName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Group Name:</span>
                    <span class="value">
                        <input type="text" id="confirm-group-name" value="${groupName}" class="editable-field">
                    </span>
                </div>
                <div class="detail-row">
                    <span class="label">Team Leader:</span>
                    <span class="value">${leaderName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Members:</span>
                    <span class="value">${membersList}</span>
                </div>
            </div>
            
            <div class="confirmation-buttons">
                <button id="confirm-create" class="btn btn-primary">Confirm</button>
                <button id="cancel-create" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;

                // Add some basic styles for the modal
                const modalStyle = document.createElement('style');
                modalStyle.textContent = `
        .confirmation-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .confirmation-content {
            background: white;
            padding: 20px;
            border-radius: 5px;
            max-width: 500px;
            width: 90%;
        }
        .group-details {
            margin: 15px 0;
        }
        .detail-row {
            margin: 10px 0;
            display: flex;
        }
        .label {
            font-weight: bold;
            width: 120px;
        }
        .value {
            flex-grow: 1;
        }
        .editable-field {
            width: 100%;
            padding: 5px;
        }
        .confirmation-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }
        .btn {
            padding: 8px 15px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
        }
        .btn-primary {
            background: #4a6fdc;
            color: white;
        }
        .btn-secondary {
            background: #ccc;
            color: #333;
        }
    `;

                document.body.appendChild(modalStyle);
                document.body.appendChild(confirmationModal);

                // Setup button event listeners
                const confirmCreateBtn = document.getElementById('confirm-create');
                const cancelCreateBtn = document.getElementById('cancel-create');
                const confirmGroupNameInput = document.getElementById('confirm-group-name');

                // Cancel button closes the modal
                cancelCreateBtn.addEventListener('click', () => {
                    document.body.removeChild(confirmationModal);
                    document.body.removeChild(modalStyle);
                });

                // Confirm button submits the form with possibly edited values
                confirmCreateBtn.addEventListener('click', async () => {
                    // Get the possibly edited group name
                    const finalGroupName = confirmGroupNameInput.value.trim();

                    // Validate the edited group name
                    if (!finalGroupName) {
                        alert('Group name cannot be empty');
                        return;
                    }

                    // Check if the edited name is different and already exists
                    if (finalGroupName !== groupName) {
                        const existingGroupWithSameName = groupsResult.data.find(
                            group => group.name.toLowerCase() === finalGroupName.toLowerCase()
                        );

                        if (existingGroupWithSameName) {
                            alert(`A group with the name "${finalGroupName}" already exists in this project. Please choose a different name.`);
                            return;
                        }
                    }

                    // Remove modal
                    document.body.removeChild(confirmationModal);
                    document.body.removeChild(modalStyle);

                    // Prepare final request body
                    const memberIds = members.map(member => member.id);
                    const requestBody = {
                        name: finalGroupName,
                        teamLeaderId: leaderId,
                        memberIds: memberIds
                    };

                    console.log('Submitting final group data:', requestBody);

                    // Make API request to create group
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/groups`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestBody)
                        });

                        const result = await response.json();

                        if (!response.ok) {
                            throw new Error(result.message || 'Failed to create group');
                        }

                        if (result.success) {
                            alert('Group created successfully!');

                            // Clear form
                            groupNameInput.value = '';
                            selectedMembers.innerHTML = '';
                            selectedMemberIds.clear();
                            leaderDropdown.value = 'choose';
                            updateLeaderDropdown();

                            // Reload groups for the current project
                            await loadGroupsByProject(projectId);
                        } else {
                            throw new Error(result.message || 'Failed to create group');
                        }
                    } catch (error) {
                        console.error('Error creating group:', error);
                        alert(`Failed to create group: ${error.message}`);
                    }
                });

            } catch (error) {
                console.error('Error during validation:', error);
                alert(`Validation failed: ${error.message}`);
            }
        });
    }
    // Call the checkAuth function and handle the result
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        // Initialize page functionality here
        console.log('User is authenticated');
        // Load projects into dropdown
        await loadProjects();

        // Add event listener for when project is selected
        const projectSelect = document.getElementById('project-select');
        projectSelect.addEventListener('change', async (e) => {
            const selectedProjectId = e.target.value;

            if (selectedProjectId) {
                // Load groups for the selected project
                await loadGroupsByProject(selectedProjectId);
            } else {
                // Clear the table if "Choose a Project" is selected
                const tableBody = document.getElementById('groups-table-body');
                tableBody.innerHTML = '';
            }
        });
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

document.querySelector('.sidebar-logout-button').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '../../authentication/LoginPage.html';
});