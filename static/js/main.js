// static/js/main.js

let currentDeveloperIndex = 0;
let allDevelopers = [];
let currentFounderId = '';

// Initialize the page with sorted developers
function initializeSortedProfiles() {
    console.log('Initializing sorted profiles...');
    const url = currentFounderId ?
        `/api/profiles/all?founder_id=${currentFounderId}` :
        '/api/profiles/all';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(developers => {
            console.log(`Received ${developers.length} sorted developers`);
            allDevelopers = developers;
            currentDeveloperIndex = 0;  // Reset to first developer
            showCurrentDeveloper();
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorNotification('Failed to load profiles');
        });
}

function updateWorkDetails(profile, containerPrefix) {
    console.log(`Updating work details for ${containerPrefix} with profile:`, profile);

    // Update work styles - use containerPrefix to be specific
    const workStyleOptions = document.querySelectorAll(`#${containerPrefix} .work-style-option`);
    const workStyles = profile.workStyles || [];
    console.log(`Work styles for ${containerPrefix}:`, workStyles);

    workStyleOptions.forEach(option => {
        const style = option.getAttribute('data-style');
        console.log(`Checking style: ${style}, Active: ${workStyles.includes(style)} for ${containerPrefix}`);

        // Maintain the base classes for styling
        const baseClasses = 'px-3 py-1 rounded-full text-sm work-style-option';

        if (workStyles.includes(style)) {
            option.className = `${baseClasses} bg-blue-100 text-blue-800`;
        } else {
            option.className = `${baseClasses} bg-gray-100 text-gray-600`;
        }
    });

    // Update location - now using city field from database
    const locationText = document.querySelector(`#${containerPrefix} .location-text`);
    if (locationText) {
        locationText.textContent = profile.city || 'Location not specified';
        console.log(`Updated location for ${containerPrefix} to:`, profile.city);
    }

    // Update skills - use containerPrefix to be specific
    const skillsContainer = document.querySelector(`#${containerPrefix} .skills-container`);
    if (skillsContainer && profile.skills) {
        skillsContainer.innerHTML = profile.skills.map(skill =>
            `<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">${skill}</span>`
        ).join('');
        console.log(`Updated skills for ${containerPrefix}:`, profile.skills);
    }
}

function showCurrentDeveloper() {
    if (allDevelopers.length === 0) {
        console.error('No developers available');
        return;
    }

    const developer = allDevelopers[currentDeveloperIndex];
    console.log('Showing developer:', developer);

    // Log the specific fields we're interested in
    console.log({
        name: developer.name,
        workStyles: developer.workStyles,
        location: developer.location,
        skills: developer.skills
    });

    updateDeveloperProfile(developer);
    updateMatchStats({
        total_score: developer.match_score.total_score,
        components: developer.match_score.components
    });
    // Reset match button when switching developers
    resetMatchButton();

}

// Add showCurrentFounder function to match showCurrentDeveloper
function showCurrentFounder() {
    if (!currentFounderId) {
        console.error('No founder selected');
        return;
    }

    console.log('Showing founder:', currentFounderId);

    // Get founder data
    fetch(`/api/founders/${currentFounderId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(founder => {
            console.log('Received founder data:', founder);
            // Log the specific fields we're interested in
            console.log({
                name: founder.name,
                workStyles: founder.workStyles,
                location: founder.city,
                skills: founder.skills
            });

            updateFounderProfile(founder);
        })
        .catch(error => {
            console.error('Error fetching founder:', error);
            showErrorNotification('Failed to load founder profile');
        });
}

function nextProfile() {
    console.log('Loading next profile...');
    if (allDevelopers.length === 0) return;

    currentDeveloperIndex = (currentDeveloperIndex + 1) % allDevelopers.length;
    showCurrentDeveloper();
}

function previousProfile() {
    console.log('Loading previous profile...');
    if (allDevelopers.length === 0) return;

    currentDeveloperIndex = (currentDeveloperIndex - 1 + allDevelopers.length) % allDevelopers.length;
    showCurrentDeveloper();
}

async function loadMatchesDashboard() {
    try {
        const response = await fetch('/api/matches');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Update stats
        const statsElements = {
            'total-matches': data.stats.total,
            'successful-matches': data.stats.successful,
            'pending-matches': data.stats.pending,
            'failed-matches': data.stats.failed
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update table
        const tableBody = document.getElementById('matches-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = data.matches.map(match => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(match.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${match.profile_snapshots.founder.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${match.profile_snapshots.developer.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold 
                        ${match.match_scores.total_score >= 75 ? 'bg-green-100 text-green-800' : 
                          match.match_scores.total_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}">
                        ${match.match_scores.total_score}%
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold 
                        ${match.status === 'successful' ? 'bg-green-100 text-green-800' :
                          match.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'}">
                        ${match.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${match.status === 'pending' ? `
                        <button onclick="updateMatchStatus('${match.id}', 'successful')" 
                                class="text-green-600 hover:text-green-900 mr-2">
                            Accept
                        </button>
                        <button onclick="updateMatchStatus('${match.id}', 'failed')"
                                class="text-red-600 hover:text-red-900">
                            Reject
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading matches dashboard:', error);
        const tableBody = document.getElementById('matches-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-red-600">
                        Error loading matches: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path === '/matches_dashboard') {
        loadMatchesDashboard();
    } else {
        initializeSortedProfiles();
    }
});

function updateDeveloperProfile(developer) {
    console.log('Updating developer profile with data:', developer);

    // Update developer profile image
    const profileImage = document.getElementById('developer-image');
    if (profileImage && developer.profileImageUrl) {
        const newImage = new Image();
        newImage.id = 'developer-image';
        newImage.className = profileImage.className;
        newImage.alt = developer.name;

        newImage.onload = function() {
            console.log('Successfully loaded new developer image');
            profileImage.parentNode.replaceChild(newImage, profileImage);
        };

        newImage.onerror = function() {
            console.error('Failed to load developer image:', developer.profileImageUrl);
            newImage.src = '/static/images/profiles/default-profile.png';
        };

        const newSrc = `${developer.profileImageUrl}?t=${new Date().getTime()}`;
        console.log('Setting new developer image src with cache-buster:', newSrc);
        newImage.src = newSrc;
    }

    // Update developer name
    const nameElement = document.querySelector('.developer-name');
    if (nameElement) nameElement.textContent = developer.name || 'Unknown Developer';

    // Update about section
    const aboutElement = document.querySelector('.developer-about');
    if (aboutElement) aboutElement.textContent = developer.about || '';

    // Update industries
    const industriesContainer = document.querySelector('.developer-industries');
    if (industriesContainer && developer.industries) {
        industriesContainer.innerHTML = developer.industries.map(industry =>
            `<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">${industry}</span>`
        ).join('');
    }

    // Update work details using the developer-specific container class
    updateWorkDetails(developer, 'developer-section');

    // Update personality results if they exist
    if (developer.personalityResults) {
        const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
        traits.forEach(trait => {
            const traitElement = document.querySelector(`.developer-personality .${trait}-score`);
            const traitBar = document.querySelector(`.developer-personality .${trait}-progress`);
            let value = developer.personalityResults[trait];

            if (traitElement) traitElement.textContent = `${value}%`;
            if (traitBar) traitBar.style.width = `${value}%`;
        });
    }

    // Update education (degrees)
    const educationContainer = document.querySelector('.developer-education');
    if (educationContainer && developer.degrees) {
        educationContainer.innerHTML = developer.degrees.map(degree =>
            `<li class="text-gray-600 text-sm">${degree}</li>`
        ).join('');
    }

    // Update work experience (companies)
    const experienceContainer = document.querySelector('.developer-experience');
    if (experienceContainer && developer.companies) {
        experienceContainer.innerHTML = developer.companies.map(company =>
            `<li class="text-gray-600 text-sm">${company}</li>`
        ).join('');
    }

    // Update interests/hobbies
    const hobbiesContainer = document.querySelector('.developer-hobbies');
    if (hobbiesContainer && developer.hobbies) {
        hobbiesContainer.innerHTML = developer.hobbies.map(hobby =>
            `<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">${hobby}</span>`
        ).join('');
    }

    // Update admiring personalities
    const admiringContainer = document.querySelector('.developer-admiring');
    if (admiringContainer && developer.admiringpersonalities) {
        admiringContainer.innerHTML = developer.admiringpersonalities.map(person =>
            `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">${person}</span>`
        ).join('');
    }
}

function updateMatchStats(data) {
    // Update total score with animation
    const totalScoreElement = document.querySelector('.total-score');
    if (totalScoreElement && data.total_score !== undefined) {
        animateNumber(totalScoreElement, parseFloat(totalScoreElement.textContent), data.total_score);
    }

    // Update component scores with animation
    if (data.components) {
        const scoreElements = {
            'skills-score': data.components.skill_score,
            'personality-score': data.components.personality_score,
            'background-score': data.components.background_score,
            'cultural-score': data.components.cultural_score
        };

        for (const [className, value] of Object.entries(scoreElements)) {
            const element = document.querySelector(`.${className}`);
            if (element && value !== undefined) {
                animateNumber(element, parseFloat(element.textContent), value);

                // Update progress bar
                const progressBarClass = className.replace('score', 'progress');
                const progressBar = document.querySelector(`.${progressBarClass}`);
                if (progressBar) {
                    progressBar.style.transition = 'width 1s ease-in-out';
                    progressBar.style.width = `${value}%`;
                }
            }
        }
    }

    updateVisualIndicators(data);
}


async function updateMatchStatus(matchId, newStatus) {
    try {
        const response = await fetch(`/api/matches/${matchId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: newStatus
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMatchNotification(`Match status updated to ${newStatus}`, 'success');
            return true;
        } else {
            throw new Error(result.error || 'Failed to update match status');
        }
    } catch (error) {
        console.error('Error updating match status:', error);
        showErrorNotification('Failed to update match status: ' + error.message);
        return false;
    }
}

async function handleMatchClick() {
    const matchButton = document.querySelector('.match-button');
    if (!matchButton) {
        console.log('Match button not found on this page');
        return;
    }

    const founderId = currentFounderId;
    const currentDeveloper = allDevelopers[currentDeveloperIndex];

    if (!founderId || !currentDeveloper) {
        showErrorNotification('Please select both a founder and developer first');
        return;
    }

    try {
        // Check for existing match
        const response = await fetch(`/api/matches/check?founder_id=${founderId}&developer_id=${currentDeveloper.id}`);
        const existingMatch = await response.json();

        if (existingMatch.exists) {
            showErrorNotification('This founder and developer are already matched');
            return;
        }

        matchButton.disabled = true;
        matchButton.innerHTML = `<span class="animate-spin">↻</span> Creating Match...`;

        const matchResponse = await fetch('/api/matches/store', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                founder_id: founderId,
                developer_id: currentDeveloper.id,
                match_scores: currentDeveloper.match_score
            })
        });

        if (!matchResponse.ok) {
            throw new Error(`HTTP error! status: ${matchResponse.status}`);
        }

        const result = await matchResponse.json();

        if (result.success) {
            matchButton.innerHTML = `✓ Matched!`;
            matchButton.classList.add('bg-green-500');
            showMatchNotification('Match created successfully!', 'success');
        }

    } catch (error) {
        console.error('Error creating match:', error);
        showErrorNotification('Failed to create match');
        resetMatchButton();
    }
}

function updateVisualIndicators(data) {
    // Add color coding based on score ranges
    const elements = {
        'total-score': data.total_score,
        'skills-score': data.components?.skill_score,
        'personality-score': data.components?.personality_score,
        'background-score': data.components?.background_score,
        'cultural-score': data.components?.cultural_score
    };

    for (const [className, value] of Object.entries(elements)) {
        const element = document.querySelector(`.${className}`);
        if (element && value !== undefined) {
            // Remove existing color classes
            element.classList.remove('text-red-600', 'text-yellow-600', 'text-green-600');

            // Add appropriate color class based on score
            if (value >= 75) {
                element.classList.add('text-green-600');
            } else if (value >= 50) {
                element.classList.add('text-yellow-600');
            } else {
                element.classList.add('text-red-600');
            }
        }
    }
}

function animateNumber(element, start, end) {
    const duration = 1000; // Animation duration in milliseconds
    const steps = 60; // Number of steps in animation
    const increment = (end - start) / steps;
    let current = start;
    let step = 0;

    const animation = setInterval(() => {
        step++;
        current += increment;
        element.textContent = `${Math.round(current)}%`;

        if (step >= steps) {
            clearInterval(animation);
            element.textContent = `${Math.round(end)}%`;
        }
    }, duration / steps);
}



function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white fade-in`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function resetMatchButton() {
    const matchButton = document.querySelector('.match-button');
    if (matchButton) {
        matchButton.innerHTML = 'Create Match';
        matchButton.classList.remove('bg-green-500');
        matchButton.classList.add('bg-blue-500');
        matchButton.disabled = false;
    }
}

// Initialize search functionality
function initializeSearch() {
    const founderSearch = document.getElementById('founder-search');
    const developerSearch = document.getElementById('developer-search');
    const founderResults = document.getElementById('founder-search-results');
    const developerResults = document.getElementById('developer-search-results');

    // Debounced search functions
    const searchFounders = debounce(async (query) => {
        if (query.length < 2) {
            founderResults.classList.add('hidden');
            return;
        }

        try {
            const response = await fetch(`/api/search/founders?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.length > 0) {
                founderResults.innerHTML = data.map(founder => `
                    <div class="p-3 hover:bg-gray-100 cursor-pointer flex items-center space-x-3" 
                         onclick="selectFounder('${founder.id}')">
                        <img src="${founder.profileImageUrl}" 
                             alt="${founder.name}" 
                             class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <div class="font-medium">${founder.name}</div>
                            <div class="text-sm text-gray-600">
                                ${founder.industries.join(', ')}
                            </div>
                        </div>
                    </div>
                `).join('');
                founderResults.classList.remove('hidden');
            } else {
                founderResults.innerHTML = '<div class="p-3 text-gray-500">No results found</div>';
                founderResults.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error searching founders:', error);
        }
    }, 300);

    const searchDevelopers = debounce(async (query) => {
        if (query.length < 2) {
            developerResults.classList.add('hidden');
            return;
        }

        try {
            const response = await fetch(`/api/search/developers?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.length > 0) {
                developerResults.innerHTML = data.map(dev => `
                    <div class="p-3 hover:bg-gray-100 cursor-pointer flex items-center space-x-3" 
                         onclick="selectDeveloper('${dev.id}')">
                        <img src="${dev.profileImageUrl}" 
                             alt="${dev.name}" 
                             class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <div class="font-medium">${dev.name}</div>
                            <div class="text-sm text-gray-600">
                                ${dev.skills.slice(0, 3).join(', ')}${dev.skills.length > 3 ? '...' : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                developerResults.classList.remove('hidden');
            } else {
                developerResults.innerHTML = '<div class="p-3 text-gray-500">No results found</div>';
                developerResults.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error searching developers:', error);
        }
    }, 300);

    // Add event listeners
    founderSearch.addEventListener('input', (e) => searchFounders(e.target.value));
    developerSearch.addEventListener('input', (e) => searchDevelopers(e.target.value));

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!founderSearch.contains(e.target) && !founderResults.contains(e.target)) {
            founderResults.classList.add('hidden');
        }
        if (!developerSearch.contains(e.target) && !developerResults.contains(e.target)) {
            developerResults.classList.add('hidden');
        }
    });
}

function updateFounderProfile(founder) {
    console.log('Updating founder profile with data:', founder);

    // Update currentFounderId
    if (founder.id) {
        currentFounderId = founder.id;
    }

    // Update founder profile image
    const profileImage = document.getElementById('founder-image');
    if (profileImage && founder.profileImageUrl) {
        const newImage = new Image();
        newImage.id = 'founder-image';
        newImage.className = profileImage.className;
        newImage.alt = founder.name;

        newImage.onload = function() {
            console.log('Successfully loaded new founder image');
            profileImage.parentNode.replaceChild(newImage, profileImage);
        };

        newImage.onerror = function() {
            console.error('Failed to load founder image:', founder.profileImageUrl);
            newImage.src = '/static/images/profiles/default-profile.png';
        };

        const newSrc = `${founder.profileImageUrl}?t=${new Date().getTime()}`;
        console.log('Setting new founder image src with cache-buster:', newSrc);
        newImage.src = newSrc;
    }

    // Update founder name
    const nameElement = document.querySelector('.founder-name');
    if (nameElement) nameElement.textContent = founder.name || 'Unknown Founder';

    // Update about section
    const aboutElement = document.querySelector('.founder-about');
    if (aboutElement) aboutElement.textContent = founder.about || '';

    // Update industries
    const industriesContainer = document.querySelector('.founder-industries');
    if (industriesContainer && founder.industries) {
        industriesContainer.innerHTML = founder.industries.map(industry =>
            `<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">${industry}</span>`
        ).join('');
    }

    // Update work details using the founder-specific container class
    updateWorkDetails(founder, 'founder-section');

    // Update personality results if they exist
    if (founder.personalityResults) {
        const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
        traits.forEach(trait => {
            const traitElement = document.querySelector(`.founder-personality .${trait}-score`);
            const traitBar = document.querySelector(`.founder-personality .${trait}-progress`);
            let value = founder.personalityResults[trait];

            if (traitElement) traitElement.textContent = `${value}%`;
            if (traitBar) traitBar.style.width = `${value}%`;
        });
    }

    // Update education (degrees)
    const educationContainer = document.querySelector('.founder-education');
    if (educationContainer && founder.degrees) {
        educationContainer.innerHTML = founder.degrees.map(degree =>
            `<li class="text-gray-600 text-sm">${degree}</li>`
        ).join('');
    }

    // Update work experience (companies)
    const experienceContainer = document.querySelector('.founder-experience');
    if (experienceContainer && founder.companies) {
        experienceContainer.innerHTML = founder.companies.map(company =>
            `<li class="text-gray-600 text-sm">${company}</li>`
        ).join('');
    }

    // Update interests/hobbies
    const hobbiesContainer = document.querySelector('.founder-hobbies');
    if (hobbiesContainer && founder.hobbies) {
        hobbiesContainer.innerHTML = founder.hobbies.map(hobby =>
            `<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">${hobby}</span>`
        ).join('');
    }

    // Update admiring personalities
    const admiringContainer = document.querySelector('.founder-admiring');
    if (admiringContainer && founder.admiringpersonalities) {
        admiringContainer.innerHTML = founder.admiringpersonalities.map(person =>
            `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">${person}</span>`
        ).join('');
    }
}

// Select a founder from search results
async function selectFounder(founderId) {
    try {
        console.log('Selecting founder with ID:', founderId);

        // Get full founder data and recalculate matches
        const response = await fetch(`/api/founders/${founderId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const founder = await response.json();
        console.log('Received founder data:', founder);

        // Update founder display
        updateFounderProfile(founder);

        // Reset developer list with new matches
        await initializeSortedProfiles();

        // Hide search results
        document.getElementById('founder-search-results').classList.add('hidden');
        document.getElementById('founder-search').value = '';

        showMatchNotification('Founder updated and matches recalculated', 'success');
    } catch (error) {
        console.error('Error selecting founder:', error);
        showErrorNotification('Failed to load founder profile');
    }
}

// Select a developer from search results
function selectDeveloper(developerId) {
    // Find developer in our existing sorted list
    const devIndex = allDevelopers.findIndex(dev => dev.id === developerId);
    if (devIndex !== -1) {
        currentDeveloperIndex = devIndex;
        showCurrentDeveloper();
    }

    // Hide search results
    document.getElementById('developer-search-results').classList.add('hidden');
    document.getElementById('developer-search').value = '';
}

async function initializeFounder() {
    try {
        // Get the first founder from the API
        const response = await fetch('/api/founders');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const founders = await response.json();

        // If we got founders, set the current ID and show the founder
        if (founders && founders.length > 0) {
            currentFounderId = founders[0].id;
            showCurrentFounder();
        }
    } catch (error) {
        console.error('Error initializing founder:', error);
    }
}

// Add to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    initializeSortedProfiles();
    initializeSearch();
    initializeFounder();
});

function showErrorNotification(message) {
    showNotification(message, 'error');
}

// Add custom styles
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        animation: fadeIn 0.3s ease-out;
    }

    .fade-out {
        animation: fadeOut 0.3s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(10px);
        }
    }
`;

document.head.appendChild(style);

// Initialize the page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSortedProfiles();
});
document.addEventListener('DOMContentLoaded', () => {
    // Add mutation observer to track DOM updates
    const founderCard = document.querySelector('.bg-white.shadow-lg.rounded-lg.p-6');
    if (founderCard) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                console.log('DOM updated:', mutation.target.className, mutation.type);
            });
        });

        observer.observe(founderCard, {
            attributes: true,
            childList: true,
            subtree: true
        });
    }
});


function showMatchNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgColor = {
        'success': 'bg-green-500',
        'warning': 'bg-yellow-500',
        'error': 'bg-red-500',
        'info': 'bg-blue-500'
    }[type] || 'bg-green-500';

    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${bgColor} text-white fade-in`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// DATABASE SECTION

// Add expansion functionality
function toggleMatchDetails(matchId) {
    console.log('Toggle called for match:', matchId);
    const detailsRow = document.getElementById(`details-${matchId}`);
    const expandBtn = document.getElementById(`expand-btn-${matchId}`);

    console.log('Found elements:', {
        detailsRow: detailsRow,
        expandBtn: expandBtn
    });

    if (!detailsRow || !expandBtn) {
        console.error('Missing elements for match:', matchId);
        return;
    }

    detailsRow.classList.toggle('hidden');
    expandBtn.style.transform = detailsRow.classList.contains('hidden') ? '' : 'rotate(90deg)';
}

// Update loadMatchesDashboard table generation
function generateMatchRow(match, index) {
    return `
        <tr id="row-${index}" class="hover:bg-gray-50 cursor-pointer" onclick="toggleMatchDetails(${index})">
            <td class="px-4 py-4">
                <button class="transform transition-transform duration-200" id="expand-btn-${index}">▶</button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(match.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${match.profile_snapshots.founder.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${match.profile_snapshots.developer.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${getScoreColor(match.match_scores.total_score)}">
                    ${match.match_scores.total_score}%
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(match.status)}">
                    ${match.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${getActionButtons(match)}
            </td>
        </tr>
        <tr id="details-${index}" class="hidden">
            <td colspan="7" class="px-6 py-4 bg-gray-50">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h3 class="text-lg font-semibold mb-2">Match Details</h3>
                        <div class="space-y-2">
                            <div>
                                <p class="text-sm font-medium text-gray-500">Skills Score</p>
                                <p class="mt-1">${match.match_scores.components.skill_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">Personality Score</p>
                                <p class="mt-1">${match.match_scores.components.personality_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">Background Score</p>
                                <p class="mt-1">${match.match_scores.components.background_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">Cultural Score</p>
                                <p class="mt-1">${match.match_scores.components.cultural_score}%</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-2">ML Features</h3>
                        <div class="space-y-2">
                            <div>
                                <p class="text-sm font-medium text-gray-500">Location Match</p>
                                <p class="mt-1">${match.ml_features.location_match ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">Industry Overlap</p>
                                <p class="mt-1">${(match.ml_features.industry_overlap * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">Experience Match</p>
                                <p class="mt-1">${(match.ml_features.experience_level_match * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}



// Update loadMatchesDashboard table part
const tableBody = document.getElementById('matches-table-body');
tableBody.innerHTML = data.matches.map((match, index) => generateMatchRow(match, index)).join('');