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

function showCurrentDeveloper() {
    if (allDevelopers.length === 0) {
        console.error('No developers available');
        return;
    }

    const developer = allDevelopers[currentDeveloperIndex];
    console.log('Showing developer:', developer);

    updateDeveloperProfile(developer);
    updateMatchStats({
        total_score: developer.match_score.total_score,
        components: developer.match_score.components
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

function replaceImage(container, newSrc) {
    // Remove existing image
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Create new image
    const img = new Image();
    img.id = 'developer-image';
    img.className = 'w-32 h-32 rounded-full object-cover border-4 border-purple-200';

    // Add cache-busting parameter
    const cacheBuster = `?t=${new Date().getTime()}`;
    img.src = newSrc + cacheBuster;

    // Set up load handler
    img.onload = () => {
        console.log('Successfully loaded new image:', newSrc);
    };

    // Set up error handler
    img.onerror = () => {
        console.error('Failed to load image:', newSrc);
        img.src = '/static/images/profiles/default-profile.png';
    };

    // Add to container
    container.appendChild(img);
}

function updateImage(imgElement, newSrc) {
    console.log('Attempting to update image with src:', newSrc);

    // Create a test image to verify the source is valid
    const testImage = new Image();
    testImage.onload = function() {
        console.log('Image source is valid, updating main image');
        imgElement.src = newSrc;
        console.log('Image src updated to:', imgElement.src);
    };

    testImage.onerror = function() {
        console.error('Failed to load image:', newSrc);
        imgElement.src = '/static/images/profiles/default-profile.png';
    };

    // Add timestamp to bust cache
    const cacheBuster = '?t=' + new Date().getTime();
    testImage.src = newSrc + cacheBuster;
}

function updateDeveloperProfile(developer) {
    console.log('Updating profile with data:', developer);

    // Update developer profile image
    const profileImage = document.getElementById('developer-image');
    if (profileImage && developer.profileImageUrl) {
        const newImage = new Image();
        newImage.id = 'developer-image';
        newImage.className = profileImage.className;
        newImage.alt = developer.name;

        newImage.onload = function() {
            console.log('Successfully loaded new image');
            profileImage.parentNode.replaceChild(newImage, profileImage);
        };

        newImage.onerror = function() {
            console.error('Failed to load image:', developer.profileImageUrl);
            newImage.src = '/static/images/profiles/default-profile.png';
        };

        const newSrc = `${developer.profileImageUrl}?t=${new Date().getTime()}`;
        console.log('Setting new src with cache-buster:', newSrc);
        newImage.src = newSrc;
    }

    // Update developer name and role
    const nameElement = document.querySelector('.developer-name');
    const roleElement = document.querySelector('.developer-role');

    if (nameElement) nameElement.textContent = developer.name;
    if (roleElement) roleElement.textContent = developer.role;

    // Update skills
    const skillsContainer = document.querySelector('.developer-skills');
    if (skillsContainer && developer.skills) {
        skillsContainer.innerHTML = developer.skills.map(skill =>
            `<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded m-1 inline-block">${skill}</span>`
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

function matchProfiles() {
    if (allDevelopers.length === 0 || currentDeveloperIndex >= allDevelopers.length) {
        showErrorNotification('No developer profile available');
        return;
    }

    const developer = allDevelopers[currentDeveloperIndex];
    updateMatchStats({
        total_score: developer.match_score.total_score,
        components: developer.match_score.components
    });
    showMatchNotification('Match calculated!', 'success');
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
        console.log('Setting currentFounderId from', currentFounderId, 'to', founder.id);
        currentFounderId = founder.id;
    }

    // Update founder profile image
    const founderImage = document.getElementById('founder-image');
    if (founderImage && founder.profileImageUrl) {
        const newImage = new Image();
        newImage.id = 'founder-image';
        newImage.className = founderImage.className;
        newImage.alt = founder.name;

        newImage.onload = function() {
            console.log('Successfully loaded new founder image');
            founderImage.parentNode.replaceChild(newImage, founderImage);
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
    if (nameElement) nameElement.textContent = founder.name;

    // Update industries
    const industriesContainer = document.querySelector('.founder-industries');
    if (industriesContainer && founder.industries) {
        industriesContainer.innerHTML = founder.industries.map(industry =>
            `<span class="px-2 py-1 bg-green-100 text-green-800 rounded m-1 inline-block">${industry}</span>`
        ).join('');
    }

    // Update about section if it exists
    const aboutElement = document.querySelector('.founder-about');
    if (aboutElement) aboutElement.textContent = founder.about || '';
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

// Add to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    initializeSortedProfiles();
    initializeSearch();
});

function showMatchNotification(message = 'Match calculated!', type = 'success') {
    showNotification(message, type);
}

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