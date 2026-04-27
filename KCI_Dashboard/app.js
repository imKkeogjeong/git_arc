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
        
        // Advanced Modules
        renderCoOccurrenceNetwork(data, palette);
        renderTopicStreamgraph(data, palette);
        renderCitationMap(data, palette);
        
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

// 5. Co-occurrence Network (D3 Force Directed Graph)
function renderCoOccurrenceNetwork(data, palette) {
    const container = d3.select("#networkContainer");
    const width = container.node().getBoundingClientRect().width;
    const height = 400;

    const links = [];
    const nodes = {};

    // Generate co-occurrence links
    data.forEach(d => {
        if (d.keywords && d.keywords.length > 1) {
            const kws = d.keywords.filter(k => k.trim() && !k.trim().startsWith("<"));
            for (let i = 0; i < kws.length; i++) {
                for (let j = i + 1; j < kws.length; j++) {
                    const source = kws[i];
                    const target = kws[j];
                    const link = links.find(l => (l.source === source && l.target === target) || (l.source === target && l.target === source));
                    if (link) {
                        link.value++;
                    } else {
                        links.push({ source, target, value: 1 });
                    }
                }
            }
        }
    });

    // Filter top links to avoid clutter
    const topLinks = links.sort((a,b) => b.value - a.value).slice(0, 80);
    topLinks.forEach(l => {
        if (!nodes[l.source]) nodes[l.source] = { id: l.source, degree: 0, group: l.source };
        if (!nodes[l.target]) nodes[l.target] = { id: l.target, degree: 0, group: l.target };
        nodes[l.source].degree += l.value;
        nodes[l.target].degree += l.value;
    });

    const nodeArray = Object.values(nodes);

    // Basic Community Detection (Label Propagation)
    for (let i = 0; i < 5; i++) { // 5 iterations for convergence
        nodeArray.forEach(n => {
            const neighbors = topLinks.filter(l => l.source.id === n.id || l.target.id === n.id);
            const neighborGroups = neighbors.map(l => l.source.id === n.id ? nodes[l.target.id].group : nodes[l.source.id].group);
            if (neighborGroups.length > 0) {
                // Pick most frequent group among neighbors
                const counts = {};
                neighborGroups.forEach(g => counts[g] = (counts[g] || 0) + 1);
                n.group = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            }
        });
    }

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);

    // Color scale for Communities (Modularity)
    const communityColorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Color scale for "Hot/Cold" links
    const linkColorScale = d3.scaleSequential(d3.interpolateInferno) 
        .domain([0, d3.max(topLinks, d => d.value)]);

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(topLinks).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
        .selectAll("line")
        .data(topLinks)
        .join("line")
        .attr("class", "link")
        .attr("stroke", d => linkColorScale(d.value))
        .attr("stroke-opacity", 0.4) // Reduced opacity for clarity
        .attr("stroke-width", d => Math.sqrt(d.value) * 1.5 + 0.5);

    const node = svg.append("g")
        .selectAll("circle")
        .data(nodeArray)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => Math.sqrt(d.degree) * 2 + 4) // Degree-based sizing
        .attr("fill", d => communityColorScale(d.group))
        .call(drag(simulation));

    node.append("title").text(d => d.id);

    const label = svg.append("g")
        .selectAll("text")
        .data(nodeArray.filter(d => d.degree > 2)) // Only show labels for core nodes
        .join("text")
        .attr("class", "label")
        .attr("dx", 10)
        .attr("dy", ".35em")
        .text(d => d.id);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);

        label.attr("x", d => d.x)
             .attr("y", d => d.y);
    });

    function drag(simulation) {
        function started(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function ended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
    }
}

// 6. Topic Streamgraph (Simulated LDA Trends)
function renderTopicStreamgraph(data, palette) {
    const container = d3.select("#streamContainer");
    const width = container.node().getBoundingClientRect().width;
    const height = 350;

    // Define topics based on keyword clusters
    const topics = ["개체화/생성", "기술철학/기계", "예술/미디어", "윤리/사회", "존재론/형이상학"];
    
    // Aggregate by year and simulated topic affinity
    const years = [...new Set(data.map(d => d.year))].sort();
    const streamData = years.map(year => {
        const entry = { year: year };
        topics.forEach(t => entry[t] = 0);
        
        data.filter(d => d.year === year).forEach(d => {
            const kws = (d.keywords || []).join(" ");
            if (kws.includes("개체") || kws.includes("생성")) entry["개체화/생성"]++;
            else if (kws.includes("기술") || kws.includes("기계")) entry["기술철학/기계"]++;
            else if (kws.includes("예술") || kws.includes("미술")) entry["예술/미디어"]++;
            else if (kws.includes("윤리") || kws.includes("사회")) entry["윤리/사회"]++;
            else entry["존재론/형이상학"]++;
        });
        return entry;
    });

    const stack = d3.stack().keys(topics).offset(d3.stackOffsetWiggle);
    const layers = stack(streamData);

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);

    const x = d3.scaleLinear()
        .domain(d3.extent(years))
        .range([40, width - 40]);

    const y = d3.scaleLinear()
        .domain([d3.min(layers, l => d3.min(l, d => d[0])), d3.max(layers, l => d3.max(l, d => d[1]))])
        .range([height - 40, 40]);

    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    const paths = svg.append("g")
        .selectAll("path")
        .data(layers)
        .join("path")
        .attr("class", (d, i) => `stream-path stream-${i}`)
        .attr("d", area)
        .attr("fill", (d, i) => palette[i % palette.length])
        .attr("opacity", 0.8)
        .style("transition", "opacity 0.2s ease");

    paths.append("title")
        .text((d, i) => topics[i]);

    // Add Year labels
    svg.append("g")
        .attr("transform", `translate(0,${height - 30})`)
        .call(d3.axisBottom(x).ticks(years.length).tickFormat(d3.format("d")))
        .attr("color", "#71717a");

    // Add Legend (Index)
    const legend = svg.append("g")
        .attr("transform", `translate(40, 20)`);

    topics.forEach((topic, i) => {
        const lg = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${i * (width/topics.length - 10)}, 0)`)
            .style("cursor", "pointer")
            .on("mouseover", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.2);
                d3.select(`.stream-${i}`).attr("opacity", 1);
            })
            .on("mouseout", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.8);
            });
        
        lg.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("rx", 2)
            .attr("fill", palette[i % palette.length]);

        lg.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .attr("fill", "#fafafa")
            .style("font-size", "11px")
            .text(topic);
    });
}

// 7. Citation Mapping (Author-Journal Network)
function renderCitationMap(data, palette) {
    const container = d3.select("#citationContainer");
    const width = container.node().getBoundingClientRect().width;
    const height = 400;

    const links = [];
    const nodes = {};

    data.forEach(d => {
        if (d.author && d.journal) {
            const author = d.author.split('(')[0];
            const journal = d.journal;
            
            nodes[author] = { id: author, type: 'author' };
            nodes[journal] = { id: journal, type: 'journal' };
            
            links.push({ source: author, target: journal });
        }
    });

    const nodeArray = Object.values(nodes);
    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", "link");

    const node = svg.append("g")
        .selectAll("circle")
        .data(nodeArray)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => d.type === 'journal' ? 8 : 4)
        .attr("fill", d => d.type === 'journal' ? palette[1] : palette[3])
        .call(d3.drag()
            .on("start", (event) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on("drag", (event) => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on("end", (event) => {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }));

    node.append("title").text(d => d.id);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });
}
