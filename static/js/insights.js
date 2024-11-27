document.addEventListener('DOMContentLoaded', function() {
    console.log('Insights JS loaded');
    initializeCharts();
    // Refresh every 5 minutes
    setInterval(initializeCharts, 300000);
});

function initializeCharts() {
    // Get data and create charts
    fetch('/api/insights/metrics')
        .then(response => response.json())
        .then(data => {
            console.log('Metrics data:', data);
            updateMetrics(data);
        })
        .catch(error => console.error('Error fetching metrics:', error));

    fetch('/api/insights/trends')
        .then(response => response.json())
        .then(data => {
            console.log('Trends data:', data);
            createDailyTrendsChart(data);
            createScoreDistributionChart(data);
        })
        .catch(error => console.error('Error fetching trends:', error));
}

function updateMetrics(data) {
    document.getElementById('total-matches').textContent = data.total_matches;
    document.getElementById('success-rate').textContent = `${data.success_rate.toFixed(1)}%`;
    document.getElementById('average-score').textContent = `${data.average_score.toFixed(1)}%`;
    document.getElementById('active-matches').textContent = data.successful_matches;
}

// In insights.js, update the createScoreDistributionChart function
function createScoreDistributionChart(data) {
    const distributionCtx = document.getElementById('score-distribution-chart');
    if (!distributionCtx) return;

    // Clear any existing chart
    if (window.scoreDistributionChart) {
        window.scoreDistributionChart.destroy();
    }

    // Initialize counters for each score range
    const scoreRanges = {
        'Exceptional (90-100%)': {count: 0, color: '#22c55e'},
        'High (80-89%)': {count: 0, color: '#84cc16'},
        'Good (70-79%)': {count: 0, color: '#eab308'},
        'Moderate (60-69%)': {count: 0, color: '#f97316'},
        'Low (Below 60%)': {count: 0, color: '#ef4444'}
    };

    // Count matches in each range
    let totalScores = 0;
    data.forEach(day => {
        day.individual_scores.forEach(score => {
            totalScores++;
            if (score >= 90) scoreRanges['Exceptional (90-100%)'].count++;
            else if (score >= 80) scoreRanges['High (80-89%)'].count++;
            else if (score >= 70) scoreRanges['Good (70-79%)'].count++;
            else if (score >= 60) scoreRanges['Moderate (60-69%)'].count++;
            else scoreRanges['Low (Below 60%)'].count++;
        });
    });

    // Calculate percentages
    const percentages = {};
    Object.entries(scoreRanges).forEach(([range, {count}]) => {
        percentages[range] = ((count / totalScores) * 100).toFixed(1);
    });

    window.scoreDistributionChart = new Chart(distributionCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(scoreRanges),
            datasets: [{
                label: 'Percentage of Matches',
                data: Object.values(percentages),
                backgroundColor: Object.values(scoreRanges).map(r => r.color),
                borderColor: Object.values(scoreRanges).map(r => r.color),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const range = context.label;
                            const percentage = context.raw;
                            const count = scoreRanges[range].count;
                            return `${count} matches (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage of Total Matches'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function createDailyTrendsChart(data) {
    const trendsCtx = document.getElementById('daily-trends-chart');
    if (!trendsCtx) {
        console.error('Could not find daily-trends-chart element');
        return;
    }

    // Sort data by date
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create dataset for total matches only
    const totalMatchesData = data.map(d => d.total_matches);

    // Destroy existing chart if it exists
    if (window.dailyTrendsChart) {
        window.dailyTrendsChart.destroy();
    }

    window.dailyTrendsChart = new Chart(trendsCtx, {
        type: 'line',
        data: {
            labels: data.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }),
            datasets: [
                {
                    label: 'Total Matches',
                    data: totalMatchesData,
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Matches: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    title: {
                        display: true,
                        text: 'Number of Matches'
                    }
                }
            }
        }
    });
}