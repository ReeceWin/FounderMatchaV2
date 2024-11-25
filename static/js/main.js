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

function updateNotificationBadge() {
    // This could update a notification counter in your UI
    const notificationBadge = document.querySelector('.notification-badge');
    if (notificationBadge) {
        const currentCount = parseInt(notificationBadge.textContent || '0');
        notificationBadge.textContent = currentCount + 1;
        notificationBadge.classList.remove('hidden');
    }
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
    const founderId = currentFounderId;
    const currentDeveloper = allDevelopers[currentDeveloperIndex];
    const developerId = currentDeveloper.id;

    if (!founderId || !developerId) {
        showErrorNotification('Please select both a founder and developer first');
        return;
    }

    try {
        // Show loading state
        const matchButton = document.querySelector('.match-button');
        const originalContent = matchButton.innerHTML;
        matchButton.innerHTML = `
            <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating Match...
        `;
        matchButton.disabled = true;

        // Create the match
        const matchResult = await createMatch(
            founderId,
            developerId,
            currentDeveloper.match_score
        );

        if (matchResult.success) {
            // Update UI to show success
            matchButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                Matched!
            `;
            matchButton.classList.add('bg-green-500', 'hover:bg-green-600');
            matchButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        } else {
            // Reset button on failure
            matchButton.innerHTML = originalContent;
            matchButton.disabled = false;
        }
    } catch (error) {
        console.error('Error in match handling:', error);
        showErrorNotification('An error occurred while creating the match');

        // Reset button
        const matchButton = document.querySelector('.match-button');
        matchButton.innerHTML = originalContent;
        matchButton.disabled = false;
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


/// MATCHES DATABASE SECTION ///

async function createMatch(founderId, developerId, matchScores) {
    try {
        const response = await fetch('/api/matches/store', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                founder_id: founderId,
                developer_id: developerId,
                match_scores: matchScores,
                initiated_by: founderId // Assuming match is initiated by founder
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMatchNotification('Match created successfully!', 'success');
            return {
                success: true,
                match_id: result.match_id
            };
        } else {
            throw new Error(result.error || 'Failed to create match');
        }
    } catch (error) {
        console.error('Error creating match:', error);
        showErrorNotification('Failed to create match: ' + error.message);
        return {
            success: false,
            error: error.message
        };
    }
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

async function matchProfiles() {
    if (allDevelopers.length === 0 || currentDeveloperIndex >= allDevelopers.length) {
        showErrorNotification('No developer profile available');
        return;
    }

    const developer = allDevelopers[currentDeveloperIndex];

    try {
        // Calculate match scores using existing functionality
        const matchScores = {
            total_score: developer.match_score.total_score,
            components: {
                skill_score: developer.match_score.components.skill_score,
                personality_score: developer.match_score.components.personality_score,
                background_score: developer.match_score.components.background_score,
                cultural_score: developer.match_score.components.cultural_score
            }
        };

        // Update UI with match scores
        updateMatchStats(matchScores);

        // If auto-save matches is enabled (you can add this as a user preference)
        const shouldSaveMatch = false; // Set this based on user preferences or UI toggle

        if (shouldSaveMatch) {
            // Create the match in Firebase
            const matchResult = await createMatch(
                currentFounderId,
                developer.id,
                matchScores
            );

            if (matchResult.success) {
                showMatchNotification('Match calculated and saved!', 'success');
            } else {
                showMatchNotification('Match calculated but not saved', 'warning');
            }
        } else {
            showMatchNotification('Match calculated!', 'success');
        }

        // Update the match button state
        updateMatchButtonState(matchScores.total_score);

    } catch (error) {
        console.error('Error in match calculation:', error);
        showErrorNotification('Error calculating match scores');
    }
}

function updateMatchButtonState(score) {
    const matchButton = document.querySelector('.match-button');
    if (!matchButton) return;

    // Update button appearance based on match score
    if (score >= 75) {
        matchButton.classList.remove('bg-blue-500', 'bg-yellow-500', 'bg-red-500');
        matchButton.classList.add('bg-green-500', 'hover:bg-green-600');
        matchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span class="ml-2">Strong Match!</span>
        `;
    } else if (score >= 50) {
        matchButton.classList.remove('bg-blue-500', 'bg-green-500', 'bg-red-500');
        matchButton.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        matchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span class="ml-2">Potential Match</span>
        `;
    } else {
        matchButton.classList.remove('bg-yellow-500', 'bg-green-500', 'bg-blue-500');
        matchButton.classList.add('bg-gray-500', 'hover:bg-gray-600');
        matchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span class="ml-2">Low Match</span>
        `;
    }

    // Enable the button to allow creating the match if desired
    matchButton.disabled = false;
}

async function getUserMatchHistory(userId, role = 'any') {
    try {
        const response = await fetch(`/api/matches/history/${userId}?role=${role}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.matches;
    } catch (error) {
        console.error('Error fetching match history:', error);
        throw error;
    }
}

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