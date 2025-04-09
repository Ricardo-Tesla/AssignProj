document.addEventListener('DOMContentLoaded', async () => {
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

    // Fetch submissions from the backend
    const fetchSubmissions = async (token, filters = {}) => {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_BASE_URL}/api/admin/submissions?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }

            const result = await response.json();
            return result.data; // Assuming the backend returns submissions in `data`
        } catch (error) {
            console.error('Error fetching submissions:', error);
            return [];
        }
    };



    // Fetch projects, groups, and members for filters
    const fetchProjects = async (token) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/projects`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const result = await response.json();
            return result.data; // Assuming the backend returns projects in `data`
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    };

    // Populate filters dynamically
    const populateFilters = (projects, submissions) => {
        const projectFilter = document.getElementById('project-filter');
        const groupFilter = document.getElementById('group-filter');
        const memberFilter = document.getElementById('member-filter');

        // Populate project filter
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.title;
            projectFilter.appendChild(option);
        });

        // Populate group and member filters based on submissions
        const groups = [...new Set(submissions.map(sub => sub.group?.name))];
        const members = [...new Set(submissions.map(sub => sub.submitter?.username))];

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            groupFilter.appendChild(option);
        });

        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            memberFilter.appendChild(option);
        });
    };



    // Populate the table with submissions
    const populateTable = async (submissions) => {
        const submissionsTableBody = document.querySelector('.submissions-table tbody');
        submissionsTableBody.innerHTML = ''; // Clear existing rows

        if (submissions.length === 0) {
            submissionsTableBody.innerHTML = '<tr><td colspan="8">No submissions found</td></tr>';
            return;
        }

        const token = localStorage.getItem('token'); // Retrieve the token from localStorage
        if (!token) {
            console.error('No token found. Please log in.');
            return;
        }

        submissions.forEach(submission => {
            const row = document.createElement('tr');

            row.innerHTML = `
    <td>${submission.group?.project?.title || 'Unknown'}</td>
    <td>${submission.group?.name || 'Unknown'}</td>
    <td>${submission.submitter?.username || 'Unknown'}</td>
    <td>${submission.task?.title || 'Unknown'}</td>
    <td>
        <a href="/api/submissions/${submission.id}/download"
            class="file-link"
            target="_blank"
            onclick="event.preventDefault(); downloadFile('${submission.id}', '${token}', '${submission.fileName || 'download'}')">
            <i class="fas fa-file"></i> ${submission.fileName || 'File'}
        </a>
    </td>
    <td>${new Date(submission.submissionTime).toLocaleString()}</td>
    <td>${submission.task?.dueDate ? new Date(submission.task.dueDate).toLocaleDateString() : 'Unknown'}</td>
    <td class="${submission.isLate ? 'late' : 'on-time'}">
        ${submission.status}${submission.isLate ? ' (Late)' : ''}
    </td>
`;

            submissionsTableBody.appendChild(row);
        });
    };

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


    // Apply filters to the submissions
    const applyFilters = (submissions) => {
        const projectFilter = document.getElementById('project-filter').value;
        const groupFilter = document.getElementById('group-filter').value;
        const memberFilter = document.getElementById('member-filter').value;
        const dateFromFilter = new Date(document.getElementById('date-from').value);
        const dateToFilter = new Date(document.getElementById('date-to').value);

        return submissions.filter(submission => {
            const submissionDate = new Date(submission.submissionTime);

            const matchesProject = projectFilter === 'all' || submission.group?.project?.id === parseInt(projectFilter);
            const matchesGroup = groupFilter === 'all' || submission.group?.name === groupFilter;
            const matchesMember = memberFilter === 'all' || submission.submitter?.username === memberFilter;
            const matchesDateFrom = isNaN(dateFromFilter.getTime()) || submissionDate >= dateFromFilter;
            const matchesDateTo = isNaN(dateToFilter.getTime()) || submissionDate <= dateToFilter;

            return matchesProject && matchesGroup && matchesMember && matchesDateFrom && matchesDateTo;
        });
    };

    // Initialize page
    const init = async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        const token = localStorage.getItem('token');
        const projects = await fetchProjects(token);
        const submissions = await fetchSubmissions(token);

        // Populate filters dynamically
        populateFilters(projects, submissions);

        // Populate the table with all submissions
        populateTable(submissions);

        // Add filter functionality
        const filterButton = document.querySelector('.filter-button');
        filterButton.addEventListener('click', () => {
            const filteredSubmissions = applyFilters(submissions);
            populateTable(filteredSubmissions);
        });
    };

    // Start the app
    init();
});



// Logout button functionality
document.querySelector('.sidebar-logout-button').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '../../authentication/LoginPage.html';
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