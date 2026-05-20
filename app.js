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

        // Global D3 Tooltip Helpers attached to window
        window.showTooltip = (event, htmlContent) => {
            const tooltip = d3.select("#global-tooltip");
            tooltip.html(htmlContent)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("opacity", 1)
                .style("transform", "translateY(0)");
        };
        window.hideTooltip = () => {
            d3.select("#global-tooltip").style("opacity", 0).style("transform", "translateY(5px)");
        };
        window.moveTooltip = (event) => {
            d3.select("#global-tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        };

        renderTimeline(data, color3);
        renderKeywords(data, palette);
        renderImpactMilestones(data, palette);
        
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
    
    // Create vibrant gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#c084fc'); // Purple
    gradient.addColorStop(1, '#3b82f6'); // Blue

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: '발행 논문 수',
                data: counts,
                backgroundColor: gradient,
                borderRadius: 6,
                barThickness: 'flex',
                maxBarThickness: 40,
                hoverBackgroundColor: '#e879f9'
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

// 2. Keyword Network (Theme-Keyword D3 Force Graph)
function renderKeywords(data, palette) {
    const container = d3.select("#keywordContainer");
    const width = container.node().getBoundingClientRect().width || 600;
    const height = 400;

    const nodesMap = new Map();
    const linksMap = new Map();

    // Collect Themes and Keywords
    data.forEach(d => {
        const theme = d.theme || '기타';
        if (!nodesMap.has(theme)) {
            nodesMap.set(theme, { id: theme, type: 'theme', value: 0 });
        }
        nodesMap.get(theme).value += 1;

        if (d.keywords && Array.isArray(d.keywords)) {
            d.keywords.forEach(k => {
                const keyword = k.trim();
                if (keyword && !keyword.startsWith("<")) {
                    if (!nodesMap.has(keyword)) {
                        nodesMap.set(keyword, { id: keyword, type: 'keyword', value: 0 });
                    }
                    nodesMap.get(keyword).value += 1;

                    const linkKey = `${theme}::${keyword}`;
                    if (!linksMap.has(linkKey)) {
                        linksMap.set(linkKey, { source: theme, target: keyword, value: 0 });
                    }
                    linksMap.get(linkKey).value += 1;
                }
            });
        }
    });

    // Filter top links to show meaningful hierarchy
    const links = Array.from(linksMap.values()).filter(l => l.value > 1).sort((a,b) => b.value - a.value).slice(0, 120);
    const validNodes = new Set();
    links.forEach(l => { validNodes.add(l.source); validNodes.add(l.target); });
    const nodes = Array.from(nodesMap.values()).filter(n => validNodes.has(n.id));

    container.html("");
    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.5, 4]).on("zoom", (e) => g.attr("transform", e.transform)));

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(d => d.type === 'theme' ? -400 : -100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => d.type === 'theme' ? 25 : 10));

    const link = g.append("g").selectAll("line").data(links).join("line")
        .attr("class", "link")
        .attr("stroke", "rgba(255,255,255,0.1)")
        .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value)));

    // Build adjacency list for hover effects
    const adjMap = new Map();
    nodes.forEach(n => adjMap.set(n.id, new Set()));
    links.forEach(l => {
        adjMap.get(l.source.id || l.source).add(l.target.id || l.target);
        adjMap.get(l.target.id || l.target).add(l.source.id || l.source);
    });

    const node = g.append("g").selectAll("circle").data(nodes).join("circle")
        .attr("class", "node")
        .attr("r", d => d.type === 'theme' ? Math.max(12, Math.sqrt(d.value)*1.5) : Math.max(4, Math.sqrt(d.value)*1.5))
        .attr("fill", d => d.type === 'theme' ? palette[2] : palette[0])
        .attr("stroke", "rgba(0,0,0,0.5)")
        .attr("stroke-width", 2)
        .call(drag(simulation))
        .on("mouseover", (event, d) => {
            // Tooltip
            const content = `
                <h4>${d.id}</h4>
                <div class="tt-meta">유형: <span style="color:#fff">${d.type === 'theme' ? 'Theme (주제)' : 'Keyword (키워드)'}</span></div>
                <div class="tt-meta">등장 빈도: <span class="tt-highlight">${d.value}</span>회</div>
                <div class="tt-meta">연결된 노드: <span style="color:#fff">${adjMap.get(d.id).size}</span>개</div>
            `;
            window.showTooltip(event, content);

            // Hover Fade
            node.style("opacity", o => (o.id === d.id || adjMap.get(d.id).has(o.id)) ? 1 : 0.1);
            link.style("opacity", o => (o.source.id === d.id || o.target.id === d.id) ? 1 : 0.05);
            label.style("opacity", o => (o.id === d.id || adjMap.get(d.id).has(o.id)) ? 1 : 0.1);
        })
        .on("mousemove", window.moveTooltip)
        .on("mouseout", () => {
            window.hideTooltip();
            node.style("opacity", 1);
            link.style("opacity", 1);
            label.style("opacity", 1);
        });

    const label = g.append("g").selectAll("text").data(nodes.filter(n => n.type === 'theme' || n.value > 5)).join("text")

        .attr("class", "label")
        .attr("dx", d => (d.type === 'theme' ? Math.max(12, Math.sqrt(d.value)*1.5) : Math.max(4, Math.sqrt(d.value)*1.5)) + 4)
        .attr("dy", 4)
        .text(d => d.id)
        .style("fill", d => d.type === 'theme' ? "#fff" : "#a1a1aa")
        .style("font-size", d => d.type === 'theme' ? "14px" : "11px")
        .style("font-weight", d => d.type === 'theme' ? "bold" : "normal");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    function drag(simulation) {
        return d3.drag()
            .on("start", e => { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
            .on("drag", e => { e.subject.fx = e.x; e.subject.fy = e.y; })
            .on("end", e => { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
    }
}

// 3. Impact Milestones (Bipartite Network: Top Papers -> Keywords)
function renderImpactMilestones(data, palette) {
    const sorted = [...data].sort((a, b) => {
        if (b.citations === a.citations) {
            return (b.year || 0) - (a.year || 0);
        }
        return b.citations - a.citations;
    });

    const topPapers = sorted.slice(0, 15);
    
    const container = d3.select("#impactContainer");
    const width = container.node().getBoundingClientRect().width || 800;
    const height = 500;

    const nodesMap = new Map();
    const links = [];

    topPapers.forEach(p => {
        const pId = "p_" + p.title;
        nodesMap.set(pId, { id: pId, label: p.title.substring(0, 20) + (p.title.length>20?"...":""), type: 'paper', citations: p.citations, full: p });
        
        if (p.keywords && Array.isArray(p.keywords)) {
            p.keywords.forEach(k => {
                const keyword = k.trim();
                if (keyword && !keyword.startsWith("<")) {
                    const kId = "k_" + keyword;
                    if (!nodesMap.has(kId)) {
                        nodesMap.set(kId, { id: kId, label: keyword, type: 'keyword', value: 1 });
                    } else {
                        nodesMap.get(kId).value += 1;
                    }
                    links.push({ source: pId, target: kId, value: p.citations });
                }
            });
        }
    });

    const nodes = Array.from(nodesMap.values());

    container.html("");
    
    // Abstract panel
    const panelHtml = `
        <div class="abstract-panel" id="impactAbstractPanel">
            <div class="close-btn" onclick="document.getElementById('impactAbstractPanel').classList.remove('active')">✕</div>
            <h3 id="panelTitle"></h3>
            <div class="meta" id="panelMeta"></div>
            <p id="panelContent"></p>
            <div style="margin-top:10px;" id="panelLink"></div>
        </div>
    `;
    container.node().insertAdjacentHTML('beforeend', panelHtml);

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.5, 3]).on("zoom", (e) => g.attr("transform", e.transform)));

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(d => d.type === 'paper' ? -600 : -150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY(height / 2).strength(0.05));

    const link = g.append("g").selectAll("line").data(links).join("line")
        .attr("class", "link")
        .attr("stroke", palette[3])
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value) * 0.5));

    const adjMap = new Map();
    nodes.forEach(n => adjMap.set(n.id, new Set()));
    links.forEach(l => {
        adjMap.get(l.source.id || l.source).add(l.target.id || l.target);
        adjMap.get(l.target.id || l.target).add(l.source.id || l.source);
    });

    const node = g.append("g").selectAll("circle").data(nodes).join("circle")
        .attr("class", "node")
        .attr("r", d => d.type === 'paper' ? Math.max(12, Math.sqrt(d.citations)*2) : Math.max(5, d.value*2))
        .attr("fill", d => d.type === 'paper' ? palette[4] : palette[1])
        .attr("stroke", d => d.type === 'paper' ? "#fff" : "none")
        .attr("stroke-width", 2)
        .call(drag(simulation))
        .on("mouseover", (event, d) => {
            const content = d.type === 'paper' ? `
                <h4>${d.label}</h4>
                <div class="tt-meta">유형: <span style="color:#fff">Paper (논문)</span></div>
                <div class="tt-meta">피인용: <span class="tt-highlight">${d.citations}</span>회</div>
                <div class="tt-meta">파생 키워드: <span style="color:#fff">${adjMap.get(d.id).size}</span>개</div>
                <div class="tt-meta" style="margin-top:5px; color:${palette[1]}">클릭하여 초록 보기</div>
            ` : `
                <h4>${d.label}</h4>
                <div class="tt-meta">유형: <span style="color:#fff">Keyword (키워드)</span></div>
                <div class="tt-meta">관련 고인용 논문: <span style="color:#fff">${adjMap.get(d.id).size}</span>편</div>
            `;
            window.showTooltip(event, content);

            node.style("opacity", o => (o.id === d.id || adjMap.get(d.id).has(o.id)) ? 1 : 0.1);
            link.style("opacity", o => (o.source.id === d.id || o.target.id === d.id) ? 1 : 0.05);
            label.style("opacity", o => (o.id === d.id || adjMap.get(d.id).has(o.id)) ? 1 : 0.1);
        })
        .on("mousemove", window.moveTooltip)
        .on("mouseout", () => {
            window.hideTooltip();
            node.style("opacity", 1);
            link.style("opacity", 1);
            label.style("opacity", 1);
        })
        .on("click", (event, d) => {
            if (d.type === 'paper') {
                const panel = document.getElementById('impactAbstractPanel');
                document.getElementById('panelTitle').innerText = d.full.title;
                document.getElementById('panelMeta').innerText = `${d.full.author} | ${d.full.journal} | ${d.full.year} | 인용수: ${d.full.citations}`;
                document.getElementById('panelContent').innerText = d.full.abstract ? d.full.abstract : "초록 정보가 없습니다.";
                document.getElementById('panelLink').innerHTML = d.full.url ? `<a href="${d.full.url}" target="_blank" class="kci-link">KCI 원문 바로가기 ↗</a>` : '';
                panel.classList.add('active');
            }
        });

    const label = g.append("g").selectAll("text").data(nodes).join("text")
        .attr("class", "label")
        .attr("dx", d => (d.type === 'paper' ? Math.max(12, Math.sqrt(d.citations)*2) : Math.max(5, d.value*2)) + 5)
        .attr("dy", 4)
        .text(d => d.label)
        .style("fill", d => d.type === 'paper' ? "#fff" : "#a1a1aa")
        .style("font-weight", d => d.type === 'paper' ? "bold" : "normal");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    function drag(simulation) {
        return d3.drag()
            .on("start", e => { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
            .on("drag", e => { e.subject.fx = e.x; e.subject.fy = e.y; })
            .on("end", e => { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
    }
}

// 5. Co-occurrence Network (D3 Force Directed Graph)
function renderCoOccurrenceNetwork(data, palette) {
    const container = d3.select("#networkContainer");
    const width = container.node().getBoundingClientRect().width || 800;
    const height = 600;

    const nodes = {};
    const linksMap = new Map();

    data.forEach(d => {
        if (d.keywords && d.keywords.length > 1) {
            const kws = d.keywords.filter(k => k.trim() && !k.trim().startsWith("<"));
            for (let i = 0; i < kws.length; i++) {
                for (let j = i + 1; j < kws.length; j++) {
                    const [source, target] = kws[i] < kws[j] ? [kws[i], kws[j]] : [kws[j], kws[i]];
                    const key = `${source}::${target}`;
                    if (linksMap.has(key)) {
                        linksMap.get(key).value++;
                    } else {
                        linksMap.set(key, { source, target, value: 1 });
                    }
                }
            }
        }
    });

    const links = Array.from(linksMap.values());
    const topLinks = links.sort((a,b) => b.value - a.value).slice(0, 100);
    
    const adjList = {};
    topLinks.forEach(l => {
        if (!nodes[l.source]) nodes[l.source] = { id: l.source, degree: 0, group: l.source };
        if (!nodes[l.target]) nodes[l.target] = { id: l.target, degree: 0, group: l.target };
        nodes[l.source].degree += l.value;
        nodes[l.target].degree += l.value;
        
        if (!adjList[l.source]) adjList[l.source] = [];
        if (!adjList[l.target]) adjList[l.target] = [];
        adjList[l.source].push(l.target);
        adjList[l.target].push(l.source);
    });

    const nodeArray = Object.values(nodes);

    for (let i = 0; i < 5; i++) {
        nodeArray.forEach(n => {
            const neighborIds = adjList[n.id] || [];
            if (neighborIds.length > 0) {
                const neighborGroups = neighborIds.map(neighborId => nodes[neighborId].group);
                const counts = {};
                neighborGroups.forEach(g => counts[g] = (counts[g] || 0) + 1);
                n.group = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            }
        });
    }

    container.html("");
    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.5, 4]).on("zoom", (e) => g.attr("transform", e.transform)));

    const uniqueGroups = [...new Set(nodeArray.map(n => n.group))].sort((a,b) => b.length - a.length).slice(0, 7);
    const symbols = [d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle, d3.symbolDiamond, d3.symbolStar, d3.symbolCross, d3.symbolWye];
    
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(uniqueGroups);
    const shapeScale = d3.scaleOrdinal().domain(uniqueGroups).range(symbols);

    // Legend
    const legend = container.append("div").attr("class", "network-legend");
    uniqueGroups.forEach(grp => {
        const item = legend.append("div").attr("class", "legend-item");
        const svgIcon = item.append("svg").attr("width", 20).attr("height", 20).attr("class", "legend-icon");
        svgIcon.append("path")
            .attr("d", d3.symbol().type(shapeScale(grp)).size(60)())
            .attr("transform", "translate(10,10)")
            .attr("fill", colorScale(grp));
        item.append("span").text(grp);
    });

    const minVal = d3.min(topLinks, d => d.value);
    const maxVal = d3.max(topLinks, d => d.value);
    const thicknessScale = d3.scalePow().exponent(2).domain([minVal, maxVal]).range([1, 15]);

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(topLinks).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g").selectAll("line").data(topLinks).join("line")
        .attr("class", "link")
        .attr("stroke", "rgba(255,255,255,0.4)")
        .attr("stroke-width", d => thicknessScale(d.value));

    const node = g.append("g").selectAll("path").data(nodeArray).join("path")
        .attr("class", "node")
        .attr("d", d => {
            const size = (Math.sqrt(d.degree) * 2 + 5) ** 2 * 3.14;
            // Default to circle if group not in top 7
            const type = uniqueGroups.includes(d.group) ? shapeScale(d.group) : d3.symbolCircle;
            return d3.symbol().type(type).size(size)();
        })
        .attr("fill", d => uniqueGroups.includes(d.group) ? colorScale(d.group) : "#555")
        .attr("stroke", "rgba(0,0,0,0.5)")
        .attr("stroke-width", 2)
        .call(drag(simulation))
        .on("mouseover", (event, d) => {
            const groupText = d.group || "기타";
            const content = `
                <h4>${d.id}</h4>
                <div class="tt-meta">소속 군집: <span style="color:${uniqueGroups.includes(d.group) ? colorScale(d.group) : '#aaa'}">${groupText}</span></div>
                <div class="tt-meta">연결 강도: <span class="tt-highlight">${d.degree}</span></div>
                <div class="tt-meta">동시 출현 노드: <span style="color:#fff">${adjList[d.id] ? adjList[d.id].length : 0}</span>개</div>
            `;
            window.showTooltip(event, content);

            const neighbors = new Set(adjList[d.id] || []);
            node.style("opacity", o => (o.id === d.id || neighbors.has(o.id)) ? 1 : 0.1);
            link.style("opacity", o => (o.source.id === d.id || o.target.id === d.id) ? 0.8 : 0.05);
            label.style("opacity", o => (o.id === d.id || neighbors.has(o.id)) ? 1 : 0.1);
        })
        .on("mousemove", window.moveTooltip)
        .on("mouseout", () => {
            window.hideTooltip();
            node.style("opacity", 1);
            link.style("opacity", 0.8); 
            label.style("opacity", 1);
        });

    // Remove the old basic title tooltip
    // node.append("title").text(d => `${d.id} (Group: ${d.group})`);

    const label = g.append("g").selectAll("text").data(nodeArray.filter(d => d.degree > 2)).join("text")
        .attr("class", "label")
        .attr("dx", d => Math.sqrt(d.degree) * 2 + 10)
        .attr("dy", 4)
        .text(d => d.id)
        .style("fill", "#fafafa");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    function drag(simulation) {
        return d3.drag()
            .on("start", e => { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
            .on("drag", e => { e.subject.fx = e.x; e.subject.fy = e.y; })
            .on("end", e => { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
    }
}

// 6. Topic Streamgraph (Simulated LDA Trends)
function renderTopicStreamgraph(data, palette) {
    const container = d3.select("#streamContainer");
    const width = container.node().getBoundingClientRect().width;
    const height = 350;

    // Define topics based on keyword clusters
    const topics = ["개체화/생성", "기술철학/기계", "예술/미디어", "윤리/사회", "존재론/형이상학"];
    
    // Aggregate by year and simulated topic affinity in O(N)
    const yearsSet = new Set();
    const yearDataMap = {};

    data.forEach(d => {
        if (!d.year) return;
        yearsSet.add(d.year);
        
        if (!yearDataMap[d.year]) {
            yearDataMap[d.year] = { year: d.year };
            topics.forEach(t => yearDataMap[d.year][t] = 0);
        }
        
        const entry = yearDataMap[d.year];
        const kws = (d.keywords || []).join(" ");
        if (kws.includes("개체") || kws.includes("생성")) entry["개체화/생성"]++;
        else if (kws.includes("기술") || kws.includes("기계")) entry["기술철학/기계"]++;
        else if (kws.includes("예술") || kws.includes("미술")) entry["예술/미디어"]++;
        else if (kws.includes("윤리") || kws.includes("사회")) entry["윤리/사회"]++;
        else entry["존재론/형이상학"]++;
    });

    const years = [...yearsSet].sort();
    const streamData = years.map(y => yearDataMap[y]);

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

    // Add Direct Labels on the Streams (at the peak of each layer)
    svg.append("g")
        .selectAll("text")
        .data(layers)
        .join("text")
        .attr("class", "stream-label")
        .attr("x", d => {
            // Find the index where the layer is thickest
            let maxVal = -1;
            let maxIdx = 0;
            d.forEach((point, i) => {
                const thickness = point[1] - point[0];
                if (thickness > maxVal) {
                    maxVal = thickness;
                    maxIdx = i;
                }
            });
            return x(d[maxIdx].data.year);
        })
        .attr("y", d => {
            let maxVal = -1;
            let maxIdx = 0;
            d.forEach((point, i) => {
                const thickness = point[1] - point[0];
                if (thickness > maxVal) {
                    maxVal = thickness;
                    maxIdx = i;
                }
            });
            return y((d[maxIdx][0] + d[maxIdx][1]) / 2);
        })
        .attr("fill", "#fff")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("text-shadow", "0 0 4px rgba(0,0,0,0.8)")
        .style("pointer-events", "none")
        .attr("text-anchor", "middle")
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

    const linksMap = new Map();
    const nodes = {};

    // 1. Data Aggregation & Degree Calculation (Optimized O(N))
    data.forEach(d => {
        if (d.author && d.journal) {
            const author = d.author.split('(')[0].trim();
            const journal = d.journal.trim();
            
            if (!nodes[author]) nodes[author] = { id: author, type: 'author', degree: 0 };
            if (!nodes[journal]) nodes[journal] = { id: journal, type: 'journal', degree: 0 };
            
            // Link aggregation for multiple papers by same author in same journal
            const key = `${author}::${journal}`;
            if (linksMap.has(key)) {
                linksMap.get(key).value++;
            } else {
                linksMap.set(key, { source: author, target: journal, value: 1 });
            }
        }
    });

    const links = Array.from(linksMap.values());

    links.forEach(l => {
        nodes[l.source].degree += l.value;
        nodes[l.target].degree += l.value;
    });

    const nodeArray = Object.values(nodes);
    
    // Clear previous content if any
    container.html("");
    
    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");

    // 2. Zoom and Pan Functionality
    const zoom = d3.zoom()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    svg.call(zoom);

    // 3. Force Simulation with optimized parameters
    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-120))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => (d.type === 'journal' ? Math.sqrt(d.degree)*5+5 : Math.sqrt(d.degree)*3+3) + 2));

    // 4. Render Links (opacity based on value)
    const link = g.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", "link")
        .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value)))
        .attr("stroke-opacity", 0.3)
        .attr("stroke", "#52525b");

    // 5. Render Nodes (Size based on degree)
    const node = g.append("g")
        .selectAll("circle")
        .data(nodeArray)
        .join("circle")
        .attr("class", "node")
        // Journals are larger than authors for the same degree
        .attr("r", d => d.type === 'journal' ? Math.max(8, Math.sqrt(d.degree) * 4) : Math.max(4, Math.sqrt(d.degree) * 2.5))
        .attr("fill", d => d.type === 'journal' ? palette[1] : palette[4])
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .call(drag(simulation));

    node.append("title").text(d => `${d.id} (${d.type === 'journal' ? '학술지' : '저자'}, 연결: ${d.degree})`);

    // 6. Render Labels (Only for journals or highly connected authors to prevent clutter)
    const label = g.append("g")
        .selectAll("text")
        .data(nodeArray.filter(d => d.type === 'journal' || d.degree > 2))
        .join("text")
        .attr("class", "label")
        .attr("dx", d => (d.type === 'journal' ? Math.max(8, Math.sqrt(d.degree) * 4) : Math.max(4, Math.sqrt(d.degree) * 2.5)) + 6)
        .attr("dy", ".35em")
        .text(d => d.id)
        .style("fill", d => d.type === 'journal' ? "#f4f4f5" : "#a1a1aa")
        .style("font-weight", d => d.type === 'journal' ? "600" : "400")
        .style("font-size", d => d.type === 'journal' ? "12px" : "10px")
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)");

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

    // Drag behavior helper
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
