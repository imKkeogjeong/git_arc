document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.KCI_DATA) {
            throw new Error("KCI_DATA is not defined. Ensure data.js is loaded.");
        }
        const data = window.KCI_DATA;

        // Common Chart Defaults for Premium Aesthetic
        Chart.defaults.color = '#a1a1aa';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.scale.grid.color = 'rgba(39, 39, 42, 0.5)';
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(24, 24, 27, 0.9)';
        Chart.defaults.plugins.tooltip.titleFont = { family: "'Outfit', sans-serif", size: 14 };
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.displayColors = false;

        const getCSSVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

        const color1 = getCSSVar('--chart-color-1') || '#818cf8';
        const color2 = getCSSVar('--chart-color-2') || '#6366f1';
        const color3 = getCSSVar('--chart-color-3') || '#4f46e5';
        const color4 = getCSSVar('--chart-color-4') || '#4338ca';
        const color5 = getCSSVar('--chart-color-5') || '#3730a3';
        
        const palette = [color1, color2, color3, color4, color5];

        renderTimeline(data, color3);
        renderLandscape(data, palette);
        renderKeywords(data, color1, color4);
        renderImpactTable(data);
        
    } catch (err) {
        console.error("Dashboard Initialization Error:", err);
    }
});

// 1. Timeline of Discourse (Bar Chart)
function renderTimeline(data, mainColor) {
    const countsByYear = {};
    data.forEach(d => {
        if (d.year) {
            countsByYear[d.year] = (countsByYear[d.year] || 0) + 1;
        }
    });

    const years = Object.keys(countsByYear).sort();
    const counts = years.map(y => countsByYear[y]);

    const ctx = document.getElementById('timelineChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: '발행 논문 수',
                data: counts,
                backgroundColor: mainColor,
                borderRadius: 4,
                barThickness: 'flex',
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 },
                    grid: { drawBorder: false }
                },
                x: {
                    grid: { display: false, drawBorder: false }
                }
            }
        }
    });
}

// 2. Disciplinary Landscape (Doughnut Chart)
function renderLandscape(data, palette) {
    const countsByTheme = {};
    data.forEach(d => {
        const theme = d.theme || '기타';
        countsByTheme[theme] = (countsByTheme[theme] || 0) + 1;
    });

    const themes = Object.keys(countsByTheme).sort((a,b) => countsByTheme[b] - countsByTheme[a]);
    const counts = themes.map(t => countsByTheme[t]);

    const ctx = document.getElementById('landscapeChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: themes,
            datasets: [{
                data: counts,
                backgroundColor: palette.slice(0, themes.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#fafafa',
                        font: { family: "'Outfit', sans-serif", size: 13 },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20
                    }
                }
            }
        }
    });
}

// 3. Keyword Network (Bubble Chart)
function renderKeywords(data, colorLight, colorDark) {
    const kwCounts = {};
    data.forEach(d => {
        if (d.keywords && Array.isArray(d.keywords)) {
            d.keywords.forEach(k => {
                const keyword = k.trim();
                // Skip weird keywords like "<아" which originated from KCI formatting
                if(keyword && !keyword.startsWith("<")) {
                    kwCounts[keyword] = (kwCounts[keyword] || 0) + 1;
                }
            });
        }
    });

    const sortedKws = Object.entries(kwCounts)
        .filter(entry => entry[1] > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25);

    const bubbleData = sortedKws.map((entry, index) => {
        const freq = entry[1];
        return {
            x: index + 1, // 순위
            y: freq,      // 출현 빈도
            r: Math.max(8, freq * 3), // 크기 조정
            keyword: entry[0]
        };
    });

    const ctx = document.getElementById('keywordChart').getContext('2d');
    new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Keywords',
                data: bubbleData,
                backgroundColor: colorLight,
                borderColor: colorDark,
                borderWidth: 1.5,
                hoverBackgroundColor: colorDark,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            return items[0].raw.keyword;
                        },
                        label: (item) => {
                            return `빈도: ${item.raw.y}회 (순위: ${item.raw.x}위)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '키워드 빈도 순위 (Rank)', color: '#52525b' },
                    grid: { display: false },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) { return value + '위'; }
                    }
                },
                y: {
                    title: { display: true, text: '출현 빈도 (Frequency)', color: '#52525b' },
                    beginAtZero: true,
                    grid: { drawBorder: false },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                }
            }
        }
    });
}

// 4. Impact Milestones (Data Table)
function renderImpactTable(data) {
    const sorted = [...data].sort((a, b) => {
        if (b.citations === a.citations) {
            return (b.year || 0) - (a.year || 0);
        }
        return b.citations - a.citations;
    });

    const top10 = sorted.slice(0, 10);
    const tbody = document.querySelector('#impactTable tbody');

    top10.forEach(d => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td class="td-year">${d.year ? d.year : '-'}</td>
            <td class="td-title" title="${d.title ? d.title.replace(/"/g, '&quot;') : ''}">${d.title}</td>
            <td class="td-author">${d.author || '-'}</td>
            <td>${d.journal || '-'}</td>
            <td class="td-citations">${d.citations}</td>
        `;
        tbody.appendChild(tr);
    });
}
