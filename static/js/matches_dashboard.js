// matches_dashboard.js

// Utility functions that were in main.js but needed here
function getScoreColor(score) {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
}

function getStatusColor(status) {
    const colors = {
        'successful': 'bg-green-100 text-green-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'failed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function showMatchNotification(message, type = 'success') {
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

function showErrorNotification(message) {
    showMatchNotification(message, 'error');
}

// Global toggle function
window.toggleMatchDetails = function(index) {
    console.log('Toggle called for index:', index);
    const detailsRow = document.getElementById(`details-${index}`);
    const expandBtn = document.getElementById(`expand-btn-${index}`);

    if (!detailsRow || !expandBtn) {
        console.error('Missing elements for match:', index);
        return;
    }

    detailsRow.classList.toggle('hidden');
    expandBtn.style.transform = detailsRow.classList.contains('hidden') ? '' : 'rotate(90deg)';
};

async function loadMatchesDashboard() {
    console.log('Loading matches dashboard...');
    try {
        const response = await fetch('/api/matches');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const matchData = await response.json();

        // Update stats
        updateDashboardStats(matchData.stats);
        // Update table
        updateDashboardTable(matchData.matches);

        console.log('Dashboard loaded successfully');
    } catch (error) {
        console.error('Error loading matches dashboard:', error);
        handleDashboardError(error);
    }
}

function updateDashboardStats(stats) {
    const statsElements = {
        'total-matches': stats.total,
        'successful-matches': stats.successful,
        'pending-matches': stats.pending,
        'failed-matches': stats.failed
    };

    Object.entries(statsElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

function updateDashboardTable(matches) {
    const tableBody = document.getElementById('matches-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = matches.map((match, index) => `
        <tr id="row-${index}" class="hover:bg-gray-50">
            <td class="px-4 py-4">
                <button class="transform transition-transform duration-200 w-6 h-6 flex items-center justify-center text-gray-500" 
                        id="expand-btn-${index}" 
                        type="button"
                        onclick="toggleMatchDetails(${index})">
                    &#9654;
                </button>
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
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex justify-between items-center">
                ${match.status === 'pending' ? `
                    <button onclick="updateMatchStatus('${match.id}', 'successful')" 
                            class="text-green-600 hover:text-green-900">
                        Successful
                    </button>
                    <button onclick="updateMatchStatus('${match.id}', 'failed')"
                            class="text-red-600 hover:text-red-900 ml-2">
                        Failed
                    </button>
                ` :
        '<div class="w-24"></div>'}
                <button onclick="deleteMatch('${match.id}', '${match.profile_snapshots.founder.name}', '${match.profile_snapshots.developer.name}')"
                        class="float-right ml-2 text-gray-500 hover:text-red-600 transition-colors" title="Delete Match">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
                </div>
            </td>
        </tr>
        ${generateDetailsRow(match, index)}
    `).join('');
}

function handleDashboardError(error) {
    const tableBody = document.getElementById('matches-table-body');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-red-600">
                    Error loading matches: ${error.message}
                </td>
            </tr>
        `;
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
            // Reload the dashboard to show updated data
            loadMatchesDashboard();
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

// Update just the details row section in updateDashboardTable function

function generateDetailsRow(match, index) {
    return `
        <tr id="details-${index}" class="hidden bg-gray-50">
            <td colspan="7" class="px-6 py-4">
            
                <div class="grid grid-cols-3 gap-6">
                    <!-- Left Column - Match Details -->
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-lg font-semibold mb-3 text-gray-800">Match Details</h3>
                            <div class="bg-white rounded-lg p-4 shadow-sm space-y-3">
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Skills Score</p>
                                    <div class="flex items-center">
                                        <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${match.match_scores.components.skill_score}%"></div>
                                        </div>
                                        <span class="text-sm font-semibold">${match.match_scores.components.skill_score}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Personality Score</p>
                                    <div class="flex items-center">
                                        <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                            <div class="bg-purple-500 h-2 rounded-full" style="width: ${match.match_scores.components.personality_score}%"></div>
                                        </div>
                                        <span class="text-sm font-semibold">${match.match_scores.components.personality_score}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Background Score</p>
                                    <div class="flex items-center">
                                        <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                            <div class="bg-green-500 h-2 rounded-full" style="width: ${match.match_scores.components.background_score}%"></div>
                                        </div>
                                        <span class="text-sm font-semibold">${match.match_scores.components.background_score}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Cultural Score</p>
                                    <div class="flex items-center">
                                        <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                            <div class="bg-yellow-500 h-2 rounded-full" style="width: ${match.match_scores.components.cultural_score}%"></div>
                                        </div>
                                        <span class="text-sm font-semibold">${match.match_scores.components.cultural_score}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Middle Column - Developer Profile -->
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-lg font-semibold mb-3 text-gray-800">Developer Profile</h3>
                            <div class="bg-white rounded-lg p-4 shadow-sm space-y-3">
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Location</p>
                                    <p class="text-sm">${match.profile_snapshots.developer.city || 'Not specified'}</p>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Skills</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.developer.skills ? 
                                            match.profile_snapshots.developer.skills.map(skill => 
                                                `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">${skill}</span>`
                                            ).join('') : 'No skills listed'}
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Work Styles</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.developer.work_styles ? 
                                            match.profile_snapshots.developer.work_styles.map(style => 
                                                `<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">${style}</span>`
                                            ).join('') : 'No work styles specified'}
                                    </div>
                                </div>
                                    <div>
                                    <p class="text-sm font-medium text-gray-500">Industries</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.developer.industries ? 
                                            match.profile_snapshots.developer.industries.map(industry => 
                                                `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">${industry}</span>`
                                            ).join('') : 'No industries listed'}
                                    </div>
                                </div>   
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Companies</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.developer.companies ? 
                                            match.profile_snapshots.developer.companies.map(company => 
                                                `<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">${company}</span>`
                                            ).join('') : 'No company history'}
                                    </div>
                                </div>       
                            </div>
                        </div>
                    </div>

                    <!-- Right Column - Founder Profile -->
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-lg font-semibold mb-3 text-gray-800">Founder Profile</h3>
                            <div class="bg-white rounded-lg p-4 shadow-sm space-y-3">
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Location</p>
                                    <p class="text-sm">${match.profile_snapshots.founder.city || 'Not specified'}</p>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Skills</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.founder.skills ? 
                                            match.profile_snapshots.founder.skills.map(skill => 
                                                `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">${skill}</span>`
                                            ).join('') : 'No skills listed'}
                                    </div>
                                </div>
                                    <div>
                                    <p class="text-sm font-medium text-gray-500">Work Styles</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.founder.work_styles ? 
                                            match.profile_snapshots.founder.work_styles.map(style => 
                                                `<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">${style}</span>`
                                            ).join('') : 'No work styles specified'}
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Industries</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.founder.industries ? 
                                            match.profile_snapshots.founder.industries.map(industry => 
                                                `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">${industry}</span>`
                                            ).join('') : 'No industries listed'}
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Companies</p>
                                    <div class="flex flex-wrap gap-2 mt-1">
                                        ${match.profile_snapshots.founder.companies ? 
                                            match.profile_snapshots.founder.companies.map(company => 
                                                `<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">${company}</span>`
                                            ).join('') : 'No company history'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ML Features Section -->
                <div class="mt-6">
                    <h3 class="text-lg font-semibold mb-3 text-gray-800">ML Features</h3>
                    <div class="grid grid-cols-4 gap-4">
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <p class="text-sm font-medium text-gray-500">Location Match</p>
                            <div class="mt-2 flex items-center">
                                <span class="text-lg font-semibold ${match.ml_features.location_match ? 'text-green-600' : 'text-red-600'}">
                                    ${match.ml_features.location_match ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <p class="text-sm font-medium text-gray-500">Industry Overlap</p>
                            <div class="mt-2 flex items-center">
                                <span class="text-lg font-semibold">
                                    ${(match.ml_features.industry_overlap * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <p class="text-sm font-medium text-gray-500">Success Rate</p>
                            <div class="mt-2">
                                <p class="text-sm">Founder: ${(match.ml_features.prior_matches.success_rate_founder * 100).toFixed(1)}%</p>
                                <p class="text-sm">Developer: ${(match.ml_features.prior_matches.success_rate_developer * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <p class="text-sm font-medium text-gray-500">Prior Matches</p>
                            <div class="mt-2">
                                <p class="text-sm">Founder: ${match.ml_features.prior_matches.founder}</p>
                                <p class="text-sm">Developer: ${match.ml_features.prior_matches.developer}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Add delete function
async function deleteMatch(matchId, founderName, developerName) {
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to delete the match between ${founderName} and ${developerName}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/matches/${matchId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMatchNotification('Match deleted successfully', 'success');
            // Reload the dashboard to reflect changes
            loadMatchesDashboard();
        } else {
            throw new Error(result.error || 'Failed to delete match');
        }
    } catch (error) {
        console.error('Error deleting match:', error);
        showErrorNotification('Failed to delete match: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Get filter elements
    const searchInput = document.getElementById('match-search');
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('date-filter');
    const scoreFilter = document.getElementById('score-filter');

    // Add event listeners
    searchInput.addEventListener('input', debounce(filterMatches, 300));
    statusFilter.addEventListener('change', filterMatches);
    dateFilter.addEventListener('change', filterMatches);
    scoreFilter.addEventListener('change', filterMatches);

    function filterMatches() {
        const searchTerm = searchInput.value.toLowerCase();
        const status = statusFilter.value;
        const dateRange = dateFilter.value;
        const scoreRange = scoreFilter.value;

        // Get all main rows (excluding detail rows)
        const mainRows = document.querySelectorAll('#matches-table-body tr[id^="row-"]');

        mainRows.forEach(row => {
            let showRow = true;
            const rowIndex = row.id.split('-')[1];
            const detailsRow = document.getElementById(`details-${rowIndex}`);

            // Search filter
            const founderName = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
            const developerName = row.querySelector('td:nth-child(4)').textContent.toLowerCase();
            if (searchTerm && !founderName.includes(searchTerm) && !developerName.includes(searchTerm)) {
                showRow = false;
            }

            // Status filter
            if (status !== 'all') {
                const statusSpan = row.querySelector('td:nth-child(6) span');
                const matchStatus = statusSpan.textContent.trim().toLowerCase();
                if (matchStatus !== status) {
                    showRow = false;
                }
            }

            // Date filter
            if (dateRange !== 'all') {
                const dateCell = row.querySelector('td:nth-child(2)').textContent;
                const matchDate = new Date(dateCell);
                const today = new Date();

                switch(dateRange) {
                    case 'today':
                        if (matchDate.toDateString() !== today.toDateString()) showRow = false;
                        break;
                    case 'week':
                        const weekAgo = new Date(today.setDate(today.getDate() - 7));
                        if (matchDate < weekAgo) showRow = false;
                        break;
                    case 'month':
                        const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
                        if (matchDate < monthAgo) showRow = false;
                        break;
                    case 'quarter':
                        const quarterAgo = new Date(today.setMonth(today.getMonth() - 3));
                        if (matchDate < quarterAgo) showRow = false;
                        break;
                }
            }

            // Score filter
            if (scoreRange !== 'all') {
                const scoreText = row.querySelector('td:nth-child(5) span').textContent;
                const score = parseFloat(scoreText);

                switch(scoreRange) {
                    case 'high':
                        if (score < 80) showRow = false;
                        break;
                    case 'medium':
                        if (score < 50 || score >= 80) showRow = false;
                        break;
                    case 'low':
                        if (score >= 50) showRow = false;
                        break;
                }
            }

            // Show/hide main row
            if (showRow) {
                row.classList.remove('hidden');
                // If details row exists and was previously expanded, show it
                if (detailsRow && !detailsRow.classList.contains('hidden')) {
                    detailsRow.classList.remove('hidden');
                }
            } else {
                row.classList.add('hidden');
                // Always hide details row when main row is hidden
                if (detailsRow) {
                    detailsRow.classList.add('hidden');
                }
            }

            // Reset expand button state if row is hidden
            if (!showRow) {
                const expandBtn = document.getElementById(`expand-btn-${rowIndex}`);
                if (expandBtn) {
                    expandBtn.style.transform = '';
                }
            }
        });

        updateMatchCount();
    }

    // Modify your existing toggleMatchDetails function
    window.toggleMatchDetails = function(index) {
        const detailsRow = document.getElementById(`details-${index}`);
        const expandBtn = document.getElementById(`expand-btn-${index}`);
        const mainRow = document.getElementById(`row-${index}`);

        // Only toggle if main row is visible
        if (!mainRow.classList.contains('hidden')) {
            detailsRow.classList.toggle('hidden');
            expandBtn.style.transform = detailsRow.classList.contains('hidden') ? '' : 'rotate(90deg)';
        }
    };

    function updateMatchCount() {
        const visibleRows = document.querySelectorAll('#matches-table-body tr[id^="row-"]:not(.hidden)').length;
        const countElement = document.getElementById('visible-matches-count');
        if (countElement) {
            countElement.textContent = `Showing ${visibleRows} matches`;
        }
    }

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
});


// Add CSS for notifications
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

// Initialize only on matches dashboard page
if (window.location.pathname === '/matches_dashboard') {
    document.addEventListener('DOMContentLoaded', loadMatchesDashboard);
}