// Global variables
let currentGroupId = null;
let currentUserRole = null; // Will be set to 'leader' or 'member'
let currentTaskId = null; // For editing existing tasks

const API_BASE_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if the user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to login only if no token exists
        window.location.href = '../../authentication/LoginPage.html';
        return;
    }

    try {
        // Get project ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('id');

        if (!projectId) {
            showNotification('Project ID not found in URL', 'error');
            setTimeout(() => {
                window.location.href = './ProjectList.html';
            }, 1500);
            return;
        }

        // Load user and project details
        await loadUserInfo(token);
        await loadProjectDetails(projectId, token);
        await fetchUserGroupAndRole(projectId, token);
        await loadTasks(token);
        await loadMySubmissions(projectId, token);


        // Use projectId and currentGroupId to load group submissions
        if (currentGroupId) {
            await loadGroupSubmissions(projectId, currentGroupId, token);
        } else {
            console.warn('No group ID found for the current user');
            document.getElementById('group-shared-files-body').innerHTML = '<tr><td colspan="5">No group assigned</td></tr>';
        }

        // Set up event listeners
        setupTaskEventListeners(token);
        setupEventListeners(projectId, token);

    } catch (error) {
        console.error('Error loading page:', error);
        // Show user-friendly error message
        showNotification(`Error: ${error.message}`, 'error');
    }
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

async function loadProjectDetails(projectId, token) {
    try {
        // Fetch project details
        const projectResponse = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!projectResponse.ok) {
            throw new Error('Failed to fetch project details');
        }

        const projectData = await projectResponse.json();

        // Populate project title and description
        document.getElementById('project-title').textContent = projectData.data.title;
        document.getElementById('project-description').textContent = projectData.data.description;

        // Format and display due date
        const dueDate = new Date(projectData.data.deadline);
        document.getElementById('due-date').textContent = `Due Date: ${dueDate.toLocaleDateString()}`;

        // Fetch group details for the logged-in user
        const groupDetails = await fetchUserGroup(projectId, token);

        // Inside loadProjectDetails function where we handle group display
        if (groupDetails) {
            // Display group name - ensure we have a name to display
            document.getElementById('assigned-group').textContent = groupDetails.name || 'Unnamed Group';

            // Format team details with leader highlighted
            let membersList = [];

            // Add team leader if available
            if (groupDetails.teamLeader) {
                membersList.push(`${groupDetails.teamLeader} (Team Leader)`);
            }

            // Add other members
            if (groupDetails.members && groupDetails.members.length > 0) {
                // Filter out the team leader if they're also in the members list
                const otherMembers = groupDetails.members.filter(member =>
                    member !== groupDetails.teamLeader);
                membersList.push(...otherMembers);
            }

            document.getElementById('group-members').textContent =
                membersList.length > 0 ? membersList.join(', ') : 'No members found';
        } else {
            // Handle case where user is not assigned to any group
            document.getElementById('assigned-group').textContent = 'No group assigned';
            document.getElementById('group-members').textContent = 'N/A';
        }
        return true;

    } catch (error) {
        console.error('Failed to load project details:', error);
        showNotification(`Error: ${error.message}`, 'error');
        return false;
    }
}

async function fetchUserGroup(projectId, token) {
    try {
        const response = await fetch(`http://localhost:5000/api/projects/${projectId}/mygroup`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.warn('Error fetching user group');
            return null;
        }

        const result = await response.json();

        // Check if the response is successful and contains data
        if (result.success && result.data) {
            return result.data;
        } else {
            console.warn('No group data found for this user');
            return null;
        }
    } catch (error) {
        console.error('Error fetching group details:', error);
        return null;
    }
}

function updateAssignedMemberOptions(groupDetails) {
    const assignedMemberSelect = document.getElementById('assigned-member');
    if (!assignedMemberSelect) return; // Exit if element doesn't exist

    // Clear existing options
    assignedMemberSelect.innerHTML = '<option value="" disabled selected>Select a member</option>';

    // Add team leader as the first option
    if (groupDetails.teamLeader) {
        const leaderOption = document.createElement('option');
        leaderOption.value = groupDetails.teamLeader;
        leaderOption.textContent = `${groupDetails.teamLeader} (Team Leader)`;
        assignedMemberSelect.appendChild(leaderOption);
    }

    // Add other members as options
    if (groupDetails.members && groupDetails.members.length > 0) {
        groupDetails.members.forEach(member => {
            // Skip if this is the team leader (already added)
            if (member !== groupDetails.teamLeader) {
                const memberOption = document.createElement('option');
                memberOption.value = member;
                memberOption.textContent = member;
                assignedMemberSelect.appendChild(memberOption);
            }
        });
    }
}


async function fetchUserGroupAndRole(projectId, token) {
    try {
        const response = await fetch(`http://localhost:5000/api/projects/${projectId}/mygroup`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch group details');
        }

        const result = await response.json();
        console.log('Group API response:', result);

        if (result.success && result.data) {
            const group = result.data;
            currentGroupId = group.id;

            // Check if current user is the team leader
            const currentUser = document.getElementById('user-name').textContent;
            if (group.teamLeader === currentUser) {
                currentUserRole = 'leader';
                document.getElementById('add-task-btn').style.display = 'block';
            } else {
                currentUserRole = 'member';
                document.getElementById('add-task-btn').style.display = 'none';
            }

            // We need to fetch the actual group members with their IDs
            const membersResponse = await fetch(`http://localhost:5000/api/groups/${group.id}/members`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                console.log('Group members data:', membersData);

                if (membersData.success && membersData.data) {
                    // Add member data to the group object
                    group.memberDetails = membersData.data;

                    // Now populate the dropdown with the correct IDs
                    updateAssignedMemberOptions(group);
                }
            }

            return group;
        } else {
            throw new Error('No group found or user not in a group');
        }
    } catch (error) {
        console.error('Error fetching group and role:', error);
        showNotification(`Error: ${error.message}`, 'error');
        return null;
    }
}

// Load tasks for the current group
async function loadTasks(token) {
    if (!currentGroupId) {
        showNotification('No group found', 'error');
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tasks');
        }

        const result = await response.json();

        if (result.success && result.data) {
            displayTasks(result.data);
        } else {
            showNotification('No tasks found for this group', 'info');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function displayTasks(tasks) {
    // Clear existing tasks
    document.getElementById('not-started-tasks').innerHTML = '<h2>Not Started (<span id="not-started-count">0</span>)</h2>';
    document.getElementById('in-progress-tasks').innerHTML = '<h2>In Progress (<span id="in-progress-count">0</span>)</h2>';
    document.getElementById('completed-tasks').innerHTML = '<h2>Completed (<span id="completed-count">0</span>)</h2>';

    // Count tasks in each category
    let notStartedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
        const taskCard = createTaskCard(task);

        // Make sure we're using the correct status values from the backend
        const status = task.status ? task.status.toLowerCase() : 'pending';

        switch (status) {
            case 'in_progress':
                document.getElementById('in-progress-tasks').appendChild(taskCard);
                inProgressCount++;
                break;
            case 'completed':
                document.getElementById('completed-tasks').appendChild(taskCard);
                completedCount++;
                break;
            case 'pending':
            default:
                document.getElementById('not-started-tasks').appendChild(taskCard);
                notStartedCount++;
                break;
        }
    });

    // Update counters
    document.getElementById('not-started-count').textContent = notStartedCount;
    document.getElementById('in-progress-count').textContent = inProgressCount;
    document.getElementById('completed-count').textContent = completedCount;
}

function createTaskCard(task) {
    const card = document.createElement('div');

    // Map backend status values to CSS class names
    let statusClass;
    switch (task.status) {
        case 'in_progress':
            statusClass = 'inprogress';
            break;
        case 'completed':
            statusClass = 'completed';
            break;
        case 'pending':
        default:
            statusClass = 'pending';
            break;
    }

    card.className = `task-card status-${statusClass}`;
    card.dataset.taskId = task.id;
    card.dataset.status = task.status || 'pending';

    const dueDate = new Date(task.dueDate);
    const formattedDate = dueDate.toLocaleDateString();

    let statusText = "";
    switch (task.status) {
        case 'in_progress':
            statusText = "In Progress";
            break;
        case 'completed':
            statusText = "Completed";
            break;
        case 'pending':
        default:
            statusText = "Not Started";
            break;
    }

    card.innerHTML = `
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        <div class="task-meta">
            <span class="assignee">Assigned to: ${task.assignedTo ? task.assignedTo.username : 'Unassigned'}</span>
            <div class="task-details">
                 <span class="due-date">Due: ${formattedDate}</span>
            <span class="task-status">${statusText}</span>
            </div>
            
        </div>
        ${currentUserRole === 'leader' ? `
        <div class="task-actions">
            <button class="edit-task-btn" data-task-id="${task.id}">Edit</button>
            <button class="delete-task-btn" data-task-id="${task.id}">Delete</button>
        </div>
        ` : ''}
    `;

    return card;
}

// Set up event listeners for task management
function setupTaskEventListeners(token) {
    const modal = document.getElementById('task-modal');
    const addTaskBtn = document.getElementById('add-task-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const taskForm = document.getElementById('task-form');
    const dueDateField = document.getElementById('due-date');


    // Populate status options
    const statusSelect = document.getElementById('task-status');
    statusSelect.innerHTML = `
<option value="not-started">Not Started</option>
<option value="in_progress">In Progress</option>
<option value="completed">Completed</option>

`;
    // Add event listener to the status dropdown
    statusSelect.addEventListener('change', () => {
        if (statusSelect.value === 'completed') {
            // Hide the due date field when status is "Completed"
            dueDateField.style.display = 'block';
            dueDateInput.removeAttribute('required');
        } else {
            // Show the due date field for other statuses
            dueDateField.style.display = 'block';
            dueDateInput.setAttribute('required', 'required');
        }
    });
    // Open modal for adding a new task
    addTaskBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Add New Task';
        resetTaskForm();
        currentTaskId = null;
        modal.style.display = 'block';
    });

    // Close modal
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    cancelTaskBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle form submission (create or update task)
    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const taskTitle = document.getElementById('task-title').value;
        const taskDesc = document.getElementById('task-desc').value;
        const assignedMember = document.getElementById('assigned-member').value;
        const taskStatus = document.getElementById('task-status').value;


        // Only include due date if the status is not "Completed"
        const dueDate = taskStatus === 'completed' ? null : document.getElementById('due-date').value;

        // Validate due date only if the status is not "Completed"
        if (taskStatus !== 'completed') {
            const selectedDate = new Date(dueDate);
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0); // Set time to midnight for comparison

            if (selectedDate < currentDate) {
                showNotification('Due date cannot be in the past. Please select a valid date.', 'error');
                return;
            }
        }

        try {
            let url, method;

            if (currentTaskId) {
                // Update existing task
                url = `http://localhost:5000/api/groups/${currentGroupId}/tasks/${currentTaskId}`;
                method = 'PUT';
            } else {
                // Create new task
                url = `http://localhost:5000/api/groups/${currentGroupId}/tasks`;
                method = 'POST';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: taskTitle,
                    description: taskDesc,
                    assignedToId: assignedMember,
                    dueDate: dueDate,
                    status: taskStatus
                })
            });

            // Check if the response is not JSON
            const contentType = response.headers.get('content-type');
            if (!response.ok || !contentType || !contentType.includes('application/json')) {
                const errorText = await response.text(); // Get the raw response text
                throw new Error(`Unexpected response: ${errorText}`);
            }

            const result = await response.json();
            // Refresh tasks
            await loadTasks(token);

            // Close modal
            modal.style.display = 'none';

            // Show success notification
            showNotification(currentTaskId ? 'Task updated successfully' : 'Task created successfully', 'success');

        } catch (error) {
            console.error('Error saving task:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    });

    // Event delegation for edit and delete buttons
    document.addEventListener('click', async (event) => {
        // Edit task
        if (event.target.classList.contains('edit-task-btn')) {
            const taskId = event.target.dataset.taskId;
            await openEditTaskModal(taskId, token);
        }

        // Delete task
        if (event.target.classList.contains('delete-task-btn')) {
            const taskId = event.target.dataset.taskId;
            await deleteTask(taskId, token);
        }
    });
}

// Open modal for editing a task
async function openEditTaskModal(taskId, token) {
    try {
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch task details');
        }

        const result = await response.json();
        const task = result.data.find(t => t.id == taskId);

        if (!task) {
            throw new Error('Task not found');
        }

        // Set form values
        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description;
        document.getElementById('assigned-member').value = task.assignedToId;

        // Format date for input
        const dueDate = new Date(task.dueDate);
        const formattedDate = dueDate.toISOString().split('T')[0];
        document.getElementById('due-date').value = formattedDate;

        document.getElementById('task-status').value = task.status || 'not-started';

        // Set current task ID for the form
        currentTaskId = taskId;

        // Open modal
        document.getElementById('task-modal').style.display = 'block';

    } catch (error) {
        console.error('Error opening edit modal:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Delete a task
async function deleteTask(taskId, token) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete task');
        }

        // Refresh tasks
        await loadTasks(token);

        // Show success notification
        showNotification('Task deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Reset task form
function resetTaskForm() {
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('assigned-member').selectedIndex = 0;
    document.getElementById('task-status').value = 'not-started';

    // Set due date to tomorrow by default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('due-date').value = formattedDate;

    // Ensure the due date field is visible and required
    const dueDateField = dueDateInput.parentElement;
    dueDateField.style.display = 'block';
    dueDateInput.setAttribute('required', 'required');
}

function updateAssignedMemberOptions(groupDetails) {
    const assignedMemberSelect = document.getElementById('assigned-member');
    if (!assignedMemberSelect) return;

    // Clear existing options
    assignedMemberSelect.innerHTML = '<option value="" disabled selected>Select a member</option>';

    console.log('Updating member options with:', groupDetails);

    // Use the memberDetails array that contains the full user objects
    if (groupDetails.memberDetails && groupDetails.memberDetails.length > 0) {
        groupDetails.memberDetails.forEach(member => {
            const option = document.createElement('option');
            option.value = member.userId; // This is the critical part - use userId

            // Mark the team leader
            const isLeader = member.userId === groupDetails.teamLeaderId;
            option.textContent = isLeader ?
                `${member.username} (Team Leader)` : member.username;

            assignedMemberSelect.appendChild(option);
            console.log('Added member option:', option.value, option.textContent);
        });
    } else {
        // Fallback if we don't have memberDetails
        console.warn('No member details available');
    }
}


// Show notification
function showNotification(message, type) {
    // You can implement this based on your notification system
    console.log(`${type}: ${message}`);
    alert(message);
}

function setupEventListeners(projectId, token) {
    // Back button event listener
    const backButton = document.getElementById('back-btn');
    backButton.addEventListener('click', () => {
        window.location.href = './ProjectList.html';
    });

    // Logout button event listener
    const logoutButton = document.querySelector('.sidebar-logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '../../authentication/LoginPage.html';
        });
    }
}




// File Upload Modal Elements
const fileUploadModal = document.getElementById('file-upload-modal');
const openFileUploadModalBtn = document.querySelector('.upload-new');
const closeFileUploadModalBtn = document.getElementById('close-file-upload-modal');
const cancelFileUploadBtn = document.getElementById('cancel-file-upload-btn');
const fileUploadForm = document.getElementById('file-upload-form');
const taskSelect = document.getElementById('task-select');
const fileInput = document.getElementById('file-input');

// Open the file upload modal
openFileUploadModalBtn.addEventListener('click', async () => {
    // Populate the task dropdown
    await populateTaskDropdown();
    fileUploadModal.style.display = 'flex';
});

// Close the file upload modal
closeFileUploadModalBtn.addEventListener('click', () => {
    fileUploadModal.style.display = 'none';
});

cancelFileUploadBtn.addEventListener('click', () => {
    fileUploadModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === fileUploadModal) {
        fileUploadModal.style.display = 'none';
    }
});

// Populate the task dropdown
async function populateTaskDropdown() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tasks');
        }

        const result = await response.json();

        if (result.success && result.data) {
            taskSelect.innerHTML = '<option value="" disabled selected>Select a task</option>';
            result.data.forEach(task => {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = task.title;
                taskSelect.appendChild(option);
            });
        } else {
            taskSelect.innerHTML = '<option value="" disabled>No tasks available</option>';
        }
    } catch (error) {
        console.error('Error populating task dropdown:', error);
        taskSelect.innerHTML = '<option value="" disabled>Error loading tasks</option>';
    }
}

// Handle file upload form submission
fileUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    const formData = new FormData(fileUploadForm);
    const file = fileInput.files[0];

    // Validate file type
    const allowedExtensions = ['txt', 'pdf'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
        alert('Invalid file type. Only .txt and .pdf files are allowed.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/api/tasks/${formData.get('taskId')}/submissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to submit file');
        }

        const result = await response.json();
        alert('File submitted successfully!');
        fileUploadModal.style.display = 'none';

        // Refresh the submissions table
        const projectId = new URLSearchParams(window.location.search).get('id');
        await loadMySubmissions(projectId, token);
    } catch (error) {
        console.error('Error submitting file:', error);
        alert(`Error: ${error.message}`);
    }
});

// Load the current user's submissions for a project
async function loadMySubmissions(projectId, token) {
    try {
        // Fetch submissions from the backend
        const response = await fetch(`http://localhost:5000/api/projects/${projectId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Backend error:', errorData);
            throw new Error(errorData.message || 'Failed to fetch your submissions');
        }

        const result = await response.json();
        console.log('Submissions API response:', result); // Log the response

        if (result.success && result.submissions) {
            // Populate the table with user's submissions
            const submissionsBody = document.getElementById('my-shared-files-body');
            submissionsBody.innerHTML = ''; // Clear existing rows

            result.submissions.forEach(submission => {
                console.log('Processing submission:', submission); // Log each submission

                const row = document.createElement('tr');

                // Check if the submission is late
                const submissionDate = new Date(submission.submissionTime);
                const dueDate = new Date(submission.dueDate);
                const isLate = submissionDate > dueDate;

                // Update the status to include "late" if applicable
                let statusText = submission.status;
                if (isLate) {
                    statusText += ' <span class="late-text">(late)</span>';
                }

                // Extract just the filename from the path
                const fullPath = submission.sharedFile;
                const fileName = fullPath.split('\\').pop().split('/').pop();

                row.innerHTML = `
            <td>${submission.task}</td>
            <td>
                <a href="/api/submissions/${submission.id}/download"
                    class="file-link"
                    target="_blank"
                    onclick="event.preventDefault(); downloadFile('${submission.id}', '${token}', '${fileName}')">
                    <i class="fas fa-file"></i> 
                    ${fileName}
                </a>
            </td>
            <td>${dueDate.toLocaleDateString()}</td>
            <td>
                <span class="status ${submission.status.toLowerCase()}">${statusText}</span>
            </td>
        `;

                submissionsBody.appendChild(row);
            });
        } else {
            console.warn('No submissions found');
            document.getElementById('my-shared-files-body').innerHTML = '<tr><td colspan="4">No submissions found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading your submissions:', error);
        document.getElementById('my-shared-files-body').innerHTML = '<tr><td colspan="4">Failed to load submissions</td></tr>';
    }
}


// Load group submissions
async function loadGroupSubmissions(projectId, groupId, token) {
    try {
        // Fetch submissions from the backend
        const response = await fetch(`http://localhost:5000/api/projects/${projectId}/groups/${groupId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Backend error:', errorData);
            throw new Error(errorData.message || 'Failed to fetch group submissions');
        }

        const result = await response.json();

        if (result.success && result.data) {
            // Populate the table with submissions
            const submissionsBody = document.getElementById('group-shared-files-body');
            submissionsBody.innerHTML = ''; // Clear existing rows

            result.data.forEach(submission => {
                const row = document.createElement('tr');

                // Check if the submission is late
                const submissionDate = new Date(submission.submissionTime);
                const dueDate = new Date(submission.Task.dueDate);
                const isLate = submissionDate > dueDate;

                // Update the status to include "late" if applicable
                let statusText = submission.status;
                if (isLate) {
                    statusText += ' <span class="late-text">(late)</span>';
                }

                row.innerHTML = `
                    <td>${submission.submitter ? submission.submitter.username : 'Unknown'}</td>
                    <td>${submission.Task.title}</td>
                    <td>
        <a href="/api/submissions/${submission.id}/download"
            class="file-link"
            target="_blank"
            onclick="event.preventDefault(); downloadFile('${submission.id}', '${token}', '${submission.fileName || 'download'}')">
            <i class="fas fa-file"></i> ${submission.fileName || 'File'}
        </a>
    </td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td>
                        <span class="status ${submission.status.toLowerCase()}">${statusText} </span>
                    </td>
                `;

                submissionsBody.appendChild(row);
            });
        } else {
            console.warn('No submissions found');
            document.getElementById('group-shared-files-body').innerHTML = '<tr><td colspan="5">No submissions found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading group submissions:', error);
        document.getElementById('group-shared-files-body').innerHTML = '<tr><td colspan="5">Failed to load submissions</td></tr>';
    }
}

// Helper function to download files with token
window.downloadFile = async (submissionId, token, defaultFilename) => {
    console.log(`Starting download for submission ID: ${submissionId}`);
    console.log(`Using token: ${token}`);
    console.log(`Default filename: ${defaultFilename}`);

    try {
        const url = `${API_BASE_URL}/api/submissions/${submissionId}/download`;
        console.log(`Fetching from URL: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`Response status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to download file. Status: ${response.status}, Message: ${errorText}`);
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }

        // Try to get filename from Content-Disposition header
        let filename = defaultFilename;
        const contentDisposition = response.headers.get('Content-Disposition');
        console.log(`Content-Disposition header: ${contentDisposition}`);
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
                console.log(`Extracted filename from header: ${filename}`);
            }
        }

        const blob = await response.blob();
        console.log('File blob created successfully.');

        const urlObject = window.URL.createObjectURL(blob);
        console.log(`Blob URL created: ${urlObject}`);

        const a = document.createElement('a');
        a.href = urlObject;
        a.download = filename;
        document.body.appendChild(a);
        console.log('Temporary download link added to the DOM.');

        a.click();
        console.log('Download initiated.');

        a.remove();
        console.log('Temporary download link removed from the DOM.');

        window.URL.revokeObjectURL(urlObject);
        console.log('Blob URL revoked.');
    } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Download failed: ${error.message}`);
    }
};


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

// Modal Functionality
const taskModal = document.getElementById('task-modal');
const addTaskBtn = document.getElementById('add-task-btn');
const closeModal = document.getElementById('close-modal');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const modalTitle = document.getElementById('modal-title');


// Open modal for adding new task
addTaskBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Add New Task';
    taskModal.style.display = 'flex';
});

// Close modal
closeModal.addEventListener('click', () => {
    taskModal.style.display = 'none';
});

cancelTaskBtn.addEventListener('click', () => {
    taskModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === taskModal) {
        taskModal.style.display = 'none';
    }
});