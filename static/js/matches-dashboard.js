// static/js/matches-dashboard.js

let currentMatches = [];
let filteredMatches = [];
let currentPage = 1;
const itemsPerPage = 10;

// Initialize Charts
let scoreDistributionChart;
let matchTimelineChart;

document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    loadMatchData();
    setupEventListeners();
});

function initializeCharts() {
    // Score Distribution Chart
    const scoreCtx = document.getElementById('scoreDistributionChart').getContext('2d');
    scoreDistributionChart = new Chart(scoreCtx, {
        type: 'bar',
        data: {
            labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
            datasets: [{
                label: 'Number of Matches',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    // Match Timeline Chart
    const timelineCtx = document.getElementById('matchTimelineChart').getContext('2d');
    matchTimelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Matches per Day',
                data: [],
                borderColor: 'rgb(59, 130, 246)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function setupEventListeners() {
    // Filter event listeners
    document.getElementById('dateRange').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('scoreFilter').addEventListener('change', applyFilters);
    document.getElementById('industryFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));

    // Export button
    document.getElementById('exportData').addEventListener('click', exportMatchData);

    // Modal close button
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('matchDetailModal').classList.add('hidden');
    });

    // Pagination buttons
    document.getElementById('prevPageMobile').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPageMobile').addEventListener('click', () => changePage(currentPage + 1));
}

async function loadMatchData() {
    try {
        const response = await fetch('/api/matches/all');
        if (!response.ok) {
            throw new Error('Failed to fetch match data');
        }

        currentMatches = await response.json();
        filteredMatches = [...currentMatches];

        updateDashboardStats();
        updateCharts();
        updateTable();
        populateIndustryFilter();
    } catch (error) {
        console.error('Error loading match data:', error);
        showErrorNotification('Failed to load match data');
    }
}

function updateDashboardStats() {
    // Update total matches
    document.getElementById('totalMatches').textContent = currentMatches.length;

    // Calculate average score
    const avgScore = currentMatches.reduce((acc, match) =>
        acc + match.scores.total_score, 0) / currentMatches.length || 0;
    document.getElementById('averageScore').textContent = `${avgScore.toFixed(1)}%`;

    // Calculate active matches
    const activeCount = currentMatches.filter(match =>
        match.status.current === 'active').length;
    document.getElementById('activeMatches').textContent = activeCount;

    // Calculate success rate
    const successfulMatches = currentMatches.filter(match =>
        match.status.current === 'completed' && match.success_metrics.success_rating >= 4).length;
    const completedMatches = currentMatches.filter(match =>
        match.status.current === 'completed').length;
    const successRate = completedMatches ? (successfulMatches / completedMatches * 100) : 0;
    document.getElementById('successRate').textContent = `${successRate.toFixed(1)}%`;
}

function updateCharts() {
    // Update Score Distribution Chart
    const scoreRanges = [0, 0, 0, 0, 0];
    currentMatches.forEach(match => {
        const score = match.scores.total_score;
        const index = Math.min(Math.floor(score / 20), 4);
        scoreRanges[index]++;
    });
    scoreDistributionChart.data.datasets[0].data = scoreRanges;
    scoreDistributionChart.update();

    // Update Timeline Chart
    const timelineData = new Map();
    currentMatches.forEach(match => {
        const date = new Date(match.timestamp).toLocaleDateString();
        timelineData.set(date, (timelineData.get(date) || 0) + 1);
    });

    const sortedDates = Array.from(timelineData.keys()).sort();
    matchTimelineChart.data.labels = sortedDates;
    matchTimelineChart.data.datasets[0].data = sortedDates.map(date => timelineData.get(date));
    matchTimelineChart.update();
}

function updateTable() {
    const tableBody = document.getElementById('matchesTableBody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const displayedMatches = filteredMatches.slice(startIndex, endIndex);

    tableBody.innerHTML = displayedMatches.map(match => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                    ${new Date(match.timestamp).toLocaleDateString()}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <img class="h-10 w-10 rounded-full" 
                             src="${match.founder_snapshot.profileImageUrl || '/static/images/profiles/default-profile.png'}" 
                             alt="${match.founder_snapshot.name}">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                            ${match.founder_snapshot.name}
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <img class="h-10 w-10 rounded-full" 
                             src="${match.developer_snapshot.profileImageUrl || '/static/images/profiles/default-profile.png'}" 
                             alt="${match.developer_snapshot.name}">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                            ${match.developer_snapshot.name}
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                    ${match.scores.total_score.toFixed(1)}%
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(match.status.current)}">
                    ${match.status.current}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="showMatchDetails('${match.match_id}')" 
                        class="text-indigo-600 hover:text-indigo-900">
                    View Details
                </button>
            </td>
        </tr>
    `).join('');

    updatePagination();
}

function getStatusColor(status) {
    const colors = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'active': 'bg-green-100 text-green-800',
        'completed': 'bg-blue-100 text-blue-800',
        'rejected': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function updatePagination() {
    const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);
    const pagination = document.getElementById('pagination');

    // Update range text
    const startRange = ((currentPage - 1) * itemsPerPage) + 1;
    const endRange = Math.min(currentPage * itemsPerPage, filteredMatches.length);
    document.getElementById('startRange').textContent = startRange;
    document.getElementById('endRange').textContent = endRange;
    document.getElementById('totalItems').textContent = filteredMatches.length;

    // Generate pagination buttons
    let paginationHTML = `
        <button onclick="changePage(${currentPage - 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <button onclick="changePage(${i})" 
                        class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                            i === currentPage ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'
                        }">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += `
                <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    ...
                </span>
            `;
        }
    }

    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

function changePage(newPage) {
    const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updateTable();
    }
}

function applyFilters() {
    const dateRange = document.getElementById('dateRange').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const scoreFilter = document.getElementById('scoreFilter').value;
    const industryFilter = document.getElementById('industryFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    // Create a Date object for comparison
    const now = new Date();
    const dateLimit = new Date();
    if (dateRange !== 'all') {
        dateLimit.setDate(now.getDate() - parseInt(dateRange));
    }

    filteredMatches = currentMatches.filter(match => {
        const matchDate = new Date(match.timestamp);

        // Date filter
        if (dateRange !== 'all' && matchDate < dateLimit) {
            return false;
        }

        // Status filter
        if (statusFilter !== 'all' && match.status.current !== statusFilter) {
            return false;
        }

        // Score filter
        if (scoreFilter !== 'all' && match.scores.total_score < parseInt(scoreFilter)) {
            return false;
        }

        // Industry filter
        if (industryFilter !== 'all' && !match.founder_snapshot.industries.includes(industryFilter)) {
            return false;
        }

        // Search term
        if (searchTerm) {
            const searchableContent = `
                ${match.founder_snapshot.name}
                ${match.developer_snapshot.name}
                ${match.founder_snapshot.industries.join(' ')}
                ${match.developer_snapshot.skills.join(' ')}
            `.toLowerCase();

            if (!searchableContent.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    currentPage = 1;
    updateDashboardStats();
    updateCharts();
    updateTable();
}

function populateIndustryFilter() {
    const industries = new Set();
    currentMatches.forEach(match => {
        match.founder_snapshot.industries.forEach(industry => industries.add(industry));
    });

    const industryFilter = document.getElementById('industryFilter');
    industryFilter.innerHTML = '<option value="all">All Industries</option>' +
        Array.from(industries).sort().map(industry =>
            `<option value="${industry}">${industry}</option>`
        ).join('');
}

async function showMatchDetails(matchId) {
    try {
        const response = await fetch(`/api/matches/${matchId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch match details');
        }

        const match = await response.json();
        const modal = document.getElementById('matchDetailModal');
        const content = document.getElementById('matchDetailContent');

        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Match Overview -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-lg mb-4">Match Overview</h4>
                    <div class="space-y-2">
                        <p><span class="font-medium">Date:</span> ${new Date(match.timestamp).toLocaleString()}</p>
                        <p><span class="font-medium">Total Score:</span> ${match.scores.total_score.toFixed(1)}%</p>
                        <p><span class="font-medium">Status:</span> 
                            <span class="px-2 py-1 rounded-full ${getStatusColor(match.status.current)}">
                                ${match.status.current}
                            </span>
                        </p>
                    </div>

                    <!-- Score Breakdown -->
                    <div class="mt-4">
                        <h5 class="font-medium mb-2">Score Breakdown</h5>
                        <div class="space-y-2">
                            <div>
                                <p class="text-sm text-gray-600">Skills Match</p>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-blue-600 h-2 rounded-full" 
                                         style="width: ${match.scores.components.skill_score}%"></div>
                                </div>
                                <p class="text-right text-sm">${match.scores.components.skill_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Personality Match</p>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-purple-600 h-2 rounded-full" 
                                         style="width: ${match.scores.components.personality_score}%"></div>
                                </div>
                                <p class="text-right text-sm">${match.scores.components.personality_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Background Match</p>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-green-600 h-2 rounded-full" 
                                         style="width: ${match.scores.components.background_score}%"></div>
                                </div>
                                <p class="text-right text-sm">${match.scores.components.background_score}%</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Cultural Match</p>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-yellow-600 h-2 rounded-full" 
                                         style="width: ${match.scores.components.cultural_score}%"></div>
                                </div>
                                <p class="text-right text-sm">${match.scores.components.cultural_score}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Profiles Comparison -->
                <div class="space-y-6">
                    <!-- Founder Profile -->
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-lg mb-4">Founder Profile</h4>
                        <div class="flex items-center mb-4">
                            <img src="${match.founder_snapshot.profileImageUrl || '/static/images/profiles/default-profile.png'}" 
                                 alt="${match.founder_snapshot.name}"
                                 class="w-12 h-12 rounded-full mr-4">
                            <div>
                                <p class="font-medium">${match.founder_snapshot.name}</p>
                                <p class="text-sm text-gray-600">${match.founder_snapshot.industries.join(', ')}</p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <p class="text-sm">${match.founder_snapshot.about || 'No description available'}</p>
                            ${renderPersonalityScores(match.founder_snapshot.personality_results)}
                        </div>
                    </div>

                    <!-- Developer Profile -->
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-lg mb-4">Developer Profile</h4>
                        <div class="flex items-center mb-4">
                            <img src="${match.developer_snapshot.profileImageUrl || '/static/images/profiles/default-profile.png'}" 
                                 alt="${match.developer_snapshot.name}"
                                 class="w-12 h-12 rounded-full mr-4">
                            <div>
                                <p class="font-medium">${match.developer_snapshot.name}</p>
                                <p class="text-sm text-gray-600">
                                    ${match.developer_snapshot.skills.join(', ')}
                                </p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            ${renderSkillsList(match.developer_snapshot.skills)}
                            ${renderPersonalityScores(match.developer_snapshot.personality_results)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status History -->
            <div class="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-lg mb-4">Status History</h4>
                <div class="space-y-2">
                    ${renderStatusHistory(match.status.history)}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error showing match details:', error);
        showErrorNotification('Failed to load match details');
    }
}

function renderPersonalityScores(personalityResults) {
    if (!personalityResults) return '';

    const traits = {
        openness: 'Openness',
        conscientiousness: 'Conscientiousness',
        extraversion: 'Extraversion',
        agreeableness: 'Agreeableness',
        neuroticism: 'Neuroticism'
    };

    return `
        <div class="mt-4">
            <h5 class="font-medium mb-2">Personality Profile</h5>
            <div class="space-y-2">
                ${Object.entries(traits).map(([key, label]) => `
                    <div>
                        <p class="text-sm text-gray-600">${label}</p>
                        <div class="w-full bg-gray-200 rounded-full h-1">
                            <div class="bg-indigo-600 h-1 rounded-full" 
                                 style="width: ${personalityResults[key]}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderSkillsList(skills) {
    if (!skills || skills.length === 0) return '';

    return `
        <div class="mt-4">
            <h5 class="font-medium mb-2">Skills</h5>
            <div class="flex flex-wrap gap-2">
                ${skills.map(skill => `
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        ${skill}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
}

function renderStatusHistory(history) {
    if (!history || history.length === 0) return '<p>No status history available</p>';

    return history.map(entry => `
        <div class="flex items-center space-x-4">
            <span class="px-2 py-1 rounded-full ${getStatusColor(entry.status)}">
                ${entry.status}
            </span>
            <span class="text-sm text-gray-600">
                ${new Date(entry.timestamp).toLocaleString()}
            </span>
        </div>
    `).join('');
}

async function exportMatchData() {
    try {
        const data = filteredMatches.map(match => ({
            match_id: match.match_id,
            timestamp: match.timestamp,
            founder_name: match.founder_snapshot.name,
            developer_name: match.developer_snapshot.name,
            total_score: match.scores.total_score,
            skill_score: match.scores.components.skill_score,
            personality_score: match.scores.components.personality_score,
            background_score: match.scores.components.background_score,
            cultural_score: match.scores.components.cultural_score,
            status: match.status.current
        }));

        const csv = convertToCSV(data);
        downloadCSV(csv, 'matches-export.csv');
    } catch (error) {
        console.error('Error exporting data:', error);
        showErrorNotification('Failed to export match data');
    }
}

function convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
        headers.map(header => JSON.stringify(row[header])).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function showErrorNotification(message) {
    // Add your notification logic here
    console.error(message);
}

// Utility function for debouncing
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

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    loadMatchData();
    setupEventListeners();
});