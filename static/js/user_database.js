// static/js/user_database.js

document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('role-filter');
    const usersGrid = document.getElementById('users-grid');
    const template = document.getElementById('user-card-template');

    let allUsers = [];

    // Fetch and display users
    async function fetchUsers() {
        try {
            const response = await fetch('/api/all_users');
            if (!response.ok) throw new Error('Failed to fetch users');

            allUsers = await response.json();
            filterAndDisplayUsers();
        } catch (error) {
            console.error('Error:', error);
            usersGrid.innerHTML = '<p class="text-red-500">Error loading users</p>';
        }
    }

    // Filter and display users based on search and role filter
    function filterAndDisplayUsers() {
        const searchTerm = searchInput.value.toLowerCase();
        const roleValue = roleFilter.value;

        const filteredUsers = allUsers.filter(user => {
            const matchesSearch =
                user.name?.toLowerCase().includes(searchTerm) ||
                user.skills?.some(skill => skill.toLowerCase().includes(searchTerm)) ||
                user.industries?.some(industry => industry.toLowerCase().includes(searchTerm));

            const matchesRole =
                roleValue === 'all' ||
                (roleValue === 'founder' && user.role === 'founder / entrepreneur') ||
                (roleValue === 'developer' && user.role === 'softwareEngineer');

            return matchesSearch && matchesRole;
        });

        displayUsers(filteredUsers);
    }

    // Display users in the grid
    function displayUsers(users) {
        usersGrid.innerHTML = '';

        users.forEach(user => {
            const card = template.content.cloneNode(true);

            // Set user image
            const userImage = card.querySelector('.user-image');
            userImage.src = user.profileImageUrl || '/static/images/profiles/default-profile.png';
            userImage.alt = user.name;

            // Set basic info
            card.querySelector('.user-name').textContent = user.name;
            card.querySelector('.user-role').textContent =
                user.role === 'founder / entrepreneur' ? 'Founder' : 'Developer';
            card.querySelector('.user-location').textContent = user.city || 'Location not specified';
            card.querySelector('.user-about').textContent = user.about || '';

            // Set skills
            const skillsContainer = card.querySelector('.user-skills');
            if (user.skills && user.skills.length > 0) {
                user.skills.forEach(skill => {
                    const span = document.createElement('span');
                    span.className = 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs';
                    span.textContent = skill;
                    skillsContainer.appendChild(span);
                });
            } else {
                skillsContainer.innerHTML = '<span class="text-gray-500 text-xs">No skills listed</span>';
            }

            // Set industries
            const industriesContainer = card.querySelector('.user-industries');
            if (user.industries && user.industries.length > 0) {
                user.industries.forEach(industry => {
                    const span = document.createElement('span');
                    span.className = 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs';
                    span.textContent = industry;
                    industriesContainer.appendChild(span);
                });
            } else {
                industriesContainer.innerHTML = '<span class="text-gray-500 text-xs">No industries listed</span>';
            }

            // Set work styles
            const workStylesContainer = card.querySelector('.user-work-styles');
            if (user.workStyles && user.workStyles.length > 0) {
                user.workStyles.forEach(style => {
                    const span = document.createElement('span');
                    span.className = 'px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs';
                    span.textContent = style;
                    workStylesContainer.appendChild(span);
                });
            } else {
                workStylesContainer.innerHTML = '<span class="text-gray-500 text-xs">No work styles listed</span>';
            }

            usersGrid.appendChild(card);
        });
    }

    // Add event listeners
    searchInput.addEventListener('input', filterAndDisplayUsers);
    roleFilter.addEventListener('change', filterAndDisplayUsers);

    // Initial fetch
    fetchUsers();
});