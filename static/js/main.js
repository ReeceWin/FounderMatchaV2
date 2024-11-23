// static/js/main.js

let currentDeveloperId = 0;

function previousProfile() {
    console.log('Loading previous profile...');
    fetch(`/api/profiles/previous?current_id=${currentDeveloperId}`)
        .then(response => response.json())
        .then(developer => {
            console.log('Received developer data:', developer);
            updateDeveloperProfile(developer);
            currentDeveloperId = developer.id;
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorNotification('Failed to load previous profile');
        });
}

function nextProfile() {
    console.log('Loading next profile...');
    fetch(`/api/profiles/next?current_id=${currentDeveloperId}`)
        .then(response => response.json())
        .then(developer => {
            console.log('Received developer data:', developer);
            updateDeveloperProfile(developer);
            currentDeveloperId = developer.id;
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorNotification('Failed to load next profile');
        });
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
        console.log('Current image:', profileImage.src);
        console.log('New image:', developer.profileImageUrl);

        // Create a new image element
        const newImage = new Image();
        newImage.id = 'developer-image';
        newImage.className = profileImage.className;
        newImage.alt = developer.name;

        // Set up handlers before setting src
        newImage.onload = function() {
            console.log('Successfully loaded new image');
            // Replace the old image with the new one
            profileImage.parentNode.replaceChild(newImage, profileImage);
        };

        newImage.onerror = function() {
            console.error('Failed to load image:', developer.profileImageUrl);
            newImage.src = '/static/images/profiles/default-profile.png';
        };

        // Add cache-busting parameter
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

function matchProfiles() {
    fetch('/api/match', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            founder_id: 1,
            developer_id: currentDeveloperId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        updateMatchStats(data);
        showMatchNotification('Match request sent!', 'success');
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorNotification('Failed to calculate match');
    });
}

function updateMatchStats(data) {
    const elements = {
        'total-score': data.total_score,
        'skills-score': data.components?.skill_score,
        'personality-score': data.components?.personality_score,
        'background-score': data.components?.background_score
    };

    for (const [className, value] of Object.entries(elements)) {
        const element = document.querySelector(`.${className}`);
        if (element && value !== undefined) {
            element.textContent = `${value}%`;
        }
    }
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

function showMatchNotification(message = 'Match request sent!', type = 'success') {
    showNotification(message, type);
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

// Initialize the first profile
document.addEventListener('DOMContentLoaded', () => {
    nextProfile();
});

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