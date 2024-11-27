// insights_charts.js

// Chart color schemes
const CHART_COLORS = {
    blue: 'rgb(54, 162, 235)',
    green: 'rgb(75, 192, 192)',
    purple: 'rgb(153, 102, 255)',
    orange: 'rgb(255, 159, 64)',
    red: 'rgb(255, 99, 132)',
    yellow: 'rgb(255, 205, 86)'
};

// Chart background colors with opacity
const BACKGROUND_COLORS = {
    blue: 'rgba(54, 162, 235, 0.1)',
    green: 'rgba(75, 192, 192, 0.1)',
    purple: 'rgba(153, 102, 255, 0.1)',
    orange: 'rgba(255, 159, 64, 0.1)',
    red: 'rgba(255, 99, 132, 0.1)',
    yellow: 'rgba(255, 205, 86, 0.1)'
};

// Common chart options
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
        },
        tooltip: {
            mode: 'index',
            intersect: false,
        }
    }
};

// Monthly Trends Chart Configuration
const createMonthlyTrendsChart = (ctx, data) => {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: 'Total Matches',
                    data: data.map(d => d.total_matches),
                    borderColor: CHART_COLORS.blue,
                    backgroundColor: BACKGROUND_COLORS.blue,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Success Rate (%)',
                    data: data.map(d => (d.successful_matches / d.total_matches * 100).toFixed(1)),
                    borderColor: CHART_COLORS.green,
                    backgroundColor: BACKGROUND_COLORS.green,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'percentage'
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                percentage: {
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
};

// Score Distribution Chart Configuration
const createScoreDistributionChart = (ctx, data) => {
    const scoreRanges = {
        '90-100': 0,
        '80-89': 0,
        '70-79': 0,
        '60-69': 0,
        '50-59': 0,
        '<50': 0
    };

    // Process data into score ranges
    data.forEach(match => {
        const score = match.match_scores.total_score;
        if (score >= 90) scoreRanges['90-100']++;
        else if (score >= 80) scoreRanges['80-89']++;
        else if (score >= 70) scoreRanges['70-79']++;
        else if (score >= 60) scoreRanges['60-69']++;
        else if (score >= 50) scoreRanges['50-59']++;
        else scoreRanges['<50']++;
    });

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(scoreRanges),
            datasets: [{
                label: 'Number of Matches',
                data: Object.values(scoreRanges),
                backgroundColor: Object.values(BACKGROUND_COLORS),
                borderColor: Object.values(CHART_COLORS),
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
};

// Match Components Chart (Radar Chart)
const createMatchComponentsChart = (ctx, data) => {
    // Calculate averages for each component
    const averages = {
        skills: 0,
        personality: 0,
        background: 0,
        cultural: 0
    };

    data.forEach(match => {
        const components = match.match_scores.components;
        averages.skills += components.skill_score;
        averages.personality += components.personality_score;
        averages.background += components.background_score;
        averages.cultural += components.cultural_score;
    });

    const count = data.length;
    Object.keys(averages).forEach(key => {
        averages[key] = (averages[key] / count).toFixed(1);
    });

    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Skills', 'Personality', 'Background', 'Cultural'],
            datasets: [{
                label: 'Average Component Scores',
                data: [
                    averages.skills,
                    averages.personality,
                    averages.background,
                    averages.cultural
                ],
                backgroundColor: BACKGROUND_COLORS.purple,
                borderColor: CHART_COLORS.purple,
                borderWidth: 2,
                pointBackgroundColor: CHART_COLORS.purple
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
};

// Time-based Success Rate Chart
const createSuccessRateChart = (ctx, data) => {
    const monthlySuccess = {};

    // Process data by month
    data.forEach(match => {
        const date = new Date(match.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlySuccess[monthKey]) {
            monthlySuccess[monthKey] = {
                total: 0,
                successful: 0
            };
        }

        monthlySuccess[monthKey].total++;
        if (match.status === 'successful') {
            monthlySuccess[monthKey].successful++;
        }
    });

    // Calculate success rates
    const chartData = Object.entries(monthlySuccess).map(([month, stats]) => ({
        month,
        rate: (stats.successful / stats.total * 100).toFixed(1)
    }));

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.month),
            datasets: [{
                label: 'Success Rate',
                data: chartData.map(d => d.rate),
                borderColor: CHART_COLORS.orange,
                backgroundColor: BACKGROUND_COLORS.orange,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
};

// Export chart creation functions
export {
    createMonthlyTrendsChart,
    createScoreDistributionChart,
    createMatchComponentsChart,
    createSuccessRateChart,
    CHART_COLORS,
    BACKGROUND_COLORS
};