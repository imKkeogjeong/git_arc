document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.KCI_DATA) {
            throw new Error("KCI_DATA is not defined. Ensure data.js is loaded.");
        }
        const data = window.KCI_DATA;

        const getCSSVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

        const palette = [
            getCSSVar('--chart-color-1') || '#2dd4bf', // Teal 400
            getCSSVar('--chart-color-2') || '#0d9488', // Teal 600
            getCSSVar('--chart-color-3') || '#8b5cf6', // Violet 500
            getCSSVar('--chart-color-4') || '#6d28d9', // Violet 700
            getCSSVar('--chart-color-5') || '#4c1d95'  // Violet 900
        ];

        // Ensure Modal functionality
        setupModal();

        // Render the 4 requested modules
        renderImpactNetwork(data, palette);
        renderCoOccurrenceNetwork(data, palette);
        renderTopicStreamgraph(data, palette);
        renderCitationMap(data, palette);
        
    } catch (err) {
        console.error("Dashboard Initialization Error:", err);
    }
});

// Modal Setup
const modal = document.getElementById("abstractModal");
const spanClose = document.getElementsByClassName("close-modal")[0];

function setupModal() {
    spanClose.onclick = function() { modal.style.display = "none"; }
    window.onclick = function(event) {
        if (event.target == modal) { modal.style.display = "none"; }
    }
}

function openModal(title, authorsStr, year, abstract) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalAuthorYear").innerText = `${authorsStr} (${year})`;
    document.getElementById("modalAbstract").innerText = abstract || "제공된 초록이 없습니다.";
    modal.style.display = "block";
}

// --------------------------------------------------------
// Module 1: Impact Milestones (Network)
// "고인용 논문을 중심으로 뻗어나가는 파생 키워드 네트워크 (노드 클릭 시 초록 확인)"
// --------------------------------------------------------
function renderImpactNetwork(data, palette) {
    const container = d3.select("#impactContainer");
    container.html(""); // clear
    const width = container.node().getBoundingClientRect().width;
    const height = 400;

    // 1. Get Top 20 Highly Cited Papers
    const topPapers = [...data].sort((a, b) => b.citations - a.citations).slice(0, 15);
    
    const nodesMap = new Map();
    const linksMap = new Map();

    topPapers.forEach(p => {
        const pId = "PAPER_" + p.id;
        nodesMap.set(pId, { 
            id: pId, 
            type: 'paper', 
            title: p.title, 
            authors: (p.authors || []).map(a=>a.name).join(', '),
            year: p.pub_year,
            abstract: p.abstract,
            citations: p.citations,
            degree: 0 
        });

        if (p.keywords_ko) {
            p.keywords_ko.forEach(k => {
                const kw = k.trim();
                if (!kw || kw.startsWith("<")) return;
                const kId = "KW_" + kw;
                if (!nodesMap.has(kId)) {
                    nodesMap.set(kId, { id: kId, type: 'keyword', label: kw, degree: 0 });
                }
                const linkKey = pId + "::" + kId;
                linksMap.set(linkKey, { source: pId, target: kId, value: 1 });
            });
        }
    });

    const links = Array.from(linksMap.values());
    links.forEach(l => {
        nodesMap.get(l.source).degree += 1;
        nodesMap.get(l.target).degree += 1;
    });

    // Remove isolated keywords
    const nodeArray = Array.from(nodesMap.values()).filter(n => n.type === 'paper' || n.degree >= 2);
    const validIds = new Set(nodeArray.map(n => n.id));
    const finalLinks = links.filter(l => validIds.has(l.source) && validIds.has(l.target));

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    
    svg.call(d3.zoom().scaleExtent([0.5, 3]).on("zoom", (e) => g.attr("transform", e.transform)));

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(finalLinks).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => d.type === 'paper' ? (d.citations/2 + 10) : 6));

    const link = g.append("g")
        .selectAll("line")
        .data(finalLinks)
        .join("line")
        .attr("stroke", "#52525b")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1);

    const node = g.append("g")
        .selectAll("circle")
        .data(nodeArray)
        .join("circle")
        .attr("r", d => d.type === 'paper' ? Math.max(8, Math.min(30, Math.sqrt(d.citations)*3 + 5)) : 4)
        .attr("fill", d => d.type === 'paper' ? palette[2] : palette[0])
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .style("cursor", d => d.type === 'paper' ? 'pointer' : 'default')
        .call(drag(simulation))
        .on("click", (event, d) => {
            if(d.type === 'paper') {
                openModal(d.title, d.authors, d.year, d.abstract);
            }
        });

    node.append("title")
        .text(d => d.type === 'paper' ? `${d.title}\n인용수: ${d.citations}` : d.label);

    const label = g.append("g")
        .selectAll("text")
        .data(nodeArray)
        .join("text")
        .text(d => d.type === 'paper' ? '' : d.label)
        .attr("font-size", "9px")
        .attr("fill", "var(--text-secondary)")
        .attr("dx", 6)
        .attr("dy", 3)
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });
}

// --------------------------------------------------------
// Module 2: Co-occurrence Network
// "개념 간 상관관계 및 군집 시각화 (선 굵기: 연관성 강도, 기호: 군집)"
// --------------------------------------------------------
function renderCoOccurrenceNetwork(data, palette) {
    const container = d3.select("#networkContainer");
    container.html("");
    const width = container.node().getBoundingClientRect().width;
    const height = 400;

    const linksMap = new Map();
    const nodes = {};

    data.forEach(d => {
        if (d.keywords_ko && d.keywords_ko.length > 1) {
            const kws = d.keywords_ko.filter(k => k.trim() && !k.trim().startsWith("<"));
            for (let i = 0; i < kws.length; i++) {
                for (let j = i + 1; j < kws.length; j++) {
                    const [source, target] = kws[i] < kws[j] ? [kws[i], kws[j]] : [kws[j], kws[i]];
                    const key = `${source}::${target}`;
                    if (linksMap.has(key)) linksMap.get(key).value++;
                    else linksMap.set(key, { source, target, value: 1 });
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

    // Community Detection (Label Propagation)
    for (let i = 0; i < 8; i++) {
        nodeArray.forEach(n => {
            const neighborIds = adjList[n.id] || [];
            if (neighborIds.length > 0) {
                const neighborGroups = neighborIds.map(nId => nodes[nId].group);
                const counts = {};
                neighborGroups.forEach(g => counts[g] = (counts[g] || 0) + 1);
                n.group = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            }
        });
    }

    // Map communities to 0-4 for symbols
    const uniqueGroups = [...new Set(nodeArray.map(n => n.group))];
    nodeArray.forEach(n => n.clusterIdx = uniqueGroups.indexOf(n.group) % 5);

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.5, 4]).on("zoom", (e) => g.attr("transform", e.transform)));

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(topLinks).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g")
        .selectAll("line")
        .data(topLinks)
        .join("line")
        .attr("stroke", "var(--text-secondary)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", d => Math.max(1, d.value * 0.8)); // Thickness = Correlation Strength

    // D3 Symbols for Clusters
    const symbolTypes = [d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle, d3.symbolDiamond, d3.symbolStar];
    
    const node = g.append("g")
        .selectAll("path")
        .data(nodeArray)
        .join("path")
        .attr("d", d => d3.symbol().type(symbolTypes[d.clusterIdx]).size(Math.max(100, d.degree * 25))())
        .attr("fill", d => palette[d.clusterIdx])
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .call(drag(simulation));

    node.append("title").text(d => `키워드: ${d.id}\n군집: ${d.clusterIdx+1}`);

    const label = g.append("g")
        .selectAll("text")
        .data(nodeArray.filter(d => d.degree > 2))
        .join("text")
        .attr("dx", 12)
        .attr("dy", 4)
        .attr("font-size", "11px")
        .attr("fill", "var(--text-primary)")
        .text(d => d.id)
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });
}

// --------------------------------------------------------
// Module 3: Topic Streamgraph
// "시기별 주제 흐름 (주요 담론의 시계열적 변화)"
// --------------------------------------------------------
function renderTopicStreamgraph(data, palette) {
    const container = d3.select("#streamContainer");
    container.html("");
    
    // Get natural width, fallback to 1000
    const containerWidth = container.node().getBoundingClientRect().width || 1000;
    const height = 500; // Premium height

    // Define the exact topics in UTF-8
    const topics = ["개체화/생성", "기술철학/기계", "예술/미디어", "윤리/사회", "존재론/형이상학"];
    const yearDataMap = {};

    // 1. Parse and filter data
    data.forEach(d => {
        // Strict boundary to prevent 186000 or other corruption
        if (!d.pub_year || d.pub_year < 1900 || d.pub_year > 2100) return;
        
        if (!yearDataMap[d.pub_year]) {
            yearDataMap[d.pub_year] = { year: d.pub_year };
            topics.forEach(t => yearDataMap[d.pub_year][t] = 0);
        }
        
        const entry = yearDataMap[d.pub_year];
        const kws = (d.keywords_ko || []).join(" ");
        if (kws.includes("개체") || kws.includes("생성")) entry["개체화/생성"]++;
        else if (kws.includes("기술") || kws.includes("기계")) entry["기술철학/기계"]++;
        else if (kws.includes("예술") || kws.includes("미디어") || kws.includes("미술")) entry["예술/미디어"]++;
        else if (kws.includes("윤리") || kws.includes("사회")) entry["윤리/사회"]++;
        else entry["존재론/형이상학"]++;
    });

    const years = Object.keys(yearDataMap).map(Number).sort((a,b) => a - b);
    if(years.length === 0) return;
    
    // 2. Fill missing years so the stream is continuous
    const minYear = years[0];
    const maxYear = years[years.length-1];
    for(let y = minYear; y <= maxYear; y++) {
        if(!yearDataMap[y]) {
            yearDataMap[y] = { year: y };
            topics.forEach(t => yearDataMap[y][t] = 0);
        }
    }
    const fullYears = Object.keys(yearDataMap).map(Number).sort((a,b) => a - b);
    const streamData = fullYears.map(y => yearDataMap[y]);

    // 3. Stack data
    const stack = d3.stack().keys(topics).offset(d3.stackOffsetWiggle);
    const layers = stack(streamData);

    // 4. Create SVG and define dimensions
    const svg = container.append("svg")
        .attr("viewBox", [0, 0, containerWidth, height])
        .style("width", "100%")
        .style("height", "auto")
        .style("max-height", "500px");

    // Dynamic inner width to prevent dense packing. At least 1200px.
    const innerWidth = Math.max(containerWidth, 1200);

    const x = d3.scaleLinear().domain(d3.extent(fullYears)).range([40, innerWidth - 40]);
    const y = d3.scaleLinear()
        .domain([d3.min(layers, l => d3.min(l, d => d[0])), d3.max(layers, l => d3.max(l, d => d[1]))])
        .range([height - 50, 60]);

    // 5. Defs: Clip path and Gradients
    const defs = svg.append("defs");
    
    defs.append("clipPath")
        .attr("id", "stream-clip")
        .append("rect")
        .attr("x", 40)
        .attr("y", 0)
        .attr("width", containerWidth - 80)
        .attr("height", height - 30);

    // Create a vertical gradient for each topic
    topics.forEach((t, i) => {
        const color = palette[i % palette.length];
        const gradient = defs.append("linearGradient")
            .attr("id", `gradient-${i}`)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 1);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.4);
    });

    // 6. Draw Streamgraph Area
    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveMonotoneX); // Smooth organic curves

    const chartGroup = svg.append("g").attr("clip-path", "url(#stream-clip)");

    const paths = chartGroup.selectAll("path")
        .data(layers)
        .join("path")
        .attr("class", (d, i) => `stream-path stream-${i}`)
        .attr("d", area)
        .attr("fill", (d, i) => `url(#gradient-${i})`)
        .attr("opacity", 0.8)
        .style("transition", "opacity 0.3s ease, stroke-width 0.2s ease");

    // 7. X-Axis with explicit formatting (ticks every 2 years)
    const xAxisGroup = svg.append("g")
        .attr("transform", `translate(0,${height - 30})`)
        .attr("color", "var(--text-secondary)");

    const tickVals = fullYears.filter(y => y % 2 === 0);
    const xAxis = d3.axisBottom(x).tickValues(tickVals).tickFormat(d => String(d));
    xAxisGroup.call(xAxis);
    xAxisGroup.selectAll("text").style("font-size", "12px");

    // 8. Interaction Layer: Crosshair and Tooltip
    const crosshair = chartGroup.append("line")
        .attr("class", "sg-crosshair")
        .attr("y1", 50)
        .attr("y2", height - 30)
        .style("opacity", 0);

    // HTML Tooltip overlay
    const tooltip = d3.select("body").append("div").attr("class", "sg-tooltip");

    // Invisible rect to capture mouse/zoom events
    const eventRect = svg.append("rect")
        .attr("width", containerWidth)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .style("cursor", "grab");

    // 9. Zoom and Pan
    const zoom = d3.zoom()
        .scaleExtent([1, 5])
        // Strict bounds to prevent flying off into infinity
        .translateExtent([[0, 0], [innerWidth, height]])
        .extent([[40, 0], [containerWidth - 40, height]])
        .on("zoom", (event) => {
            const newX = event.transform.rescaleX(x);
            area.x(d => newX(d.data.year));
            paths.attr("d", area);
            xAxisGroup.call(xAxis.scale(newX));
            xAxisGroup.selectAll("text").style("font-size", "12px");
            crosshair.style("opacity", 0); // Hide crosshair while panning
            tooltip.style("opacity", 0);
        });

    svg.call(zoom);

    eventRect.on("mousedown", () => eventRect.style("cursor", "grabbing"));
    eventRect.on("mouseup", () => eventRect.style("cursor", "grab"));

    // 10. Hover Logic for Tooltip and Highlighting
    eventRect.on("mousemove", function(event) {
        // Calculate current X position considering zoom
        const transform = d3.zoomTransform(svg.node());
        const newX = transform.rescaleX(x);
        const mouseX = d3.pointer(event)[0];
        
        // Find closest year
        const exactYear = newX.invert(mouseX);
        const year = Math.round(exactYear);

        if (year < minYear || year > maxYear) {
            crosshair.style("opacity", 0);
            tooltip.style("opacity", 0);
            paths.attr("opacity", 0.8).attr("stroke", "none");
            return;
        }

        // Snap crosshair to year
        const snappedX = newX(year);
        crosshair.attr("x1", snappedX).attr("x2", snappedX).style("opacity", 1);

        // Build Tooltip HTML
        const yearData = yearDataMap[year];
        let tooltipHtml = `<h4>${year}</h4>`;
        
        // Find which stream the mouse is currently hovering over for Y-axis
        const mouseY = d3.pointer(event)[1];
        let hoveredTopicIdx = -1;
        
        // We find if mouseY is between y0 and y1 of any layer at this year
        layers.forEach((layer, i) => {
            const dataPoint = layer.find(d => d.data.year === year);
            if (dataPoint) {
                const yTop = y(dataPoint[1]);
                const yBottom = y(dataPoint[0]);
                if (mouseY >= yTop && mouseY <= yBottom) {
                    hoveredTopicIdx = i;
                }
                
                const count = yearData[topics[i]];
                const isActive = hoveredTopicIdx === i ? "active" : "";
                tooltipHtml += `
                <div class="sg-tooltip-row ${isActive}">
                    <div><span class="sg-color-dot" style="background: ${palette[i % palette.length]}"></span>${topics[i]}</div>
                    <div class="sg-count">${count}건</div>
                </div>`;
            }
        });

        tooltip.html(tooltipHtml)
            .style("left", (event.pageX + 20) + "px")
            .style("top", (event.pageY - 20) + "px")
            .style("opacity", 1);

        // Highlight the hovered stream
        if (hoveredTopicIdx !== -1) {
            paths.attr("opacity", (d, i) => i === hoveredTopicIdx ? 1 : 0.15)
                 .attr("stroke", (d, i) => i === hoveredTopicIdx ? "#fff" : "none")
                 .attr("stroke-width", (d, i) => i === hoveredTopicIdx ? 2 : 0);
            d3.selectAll(".legend-item").attr("opacity", (d, i) => i === hoveredTopicIdx ? 1 : 0.3);
        } else {
            paths.attr("opacity", 0.8).attr("stroke", "none");
            d3.selectAll(".legend-item").attr("opacity", 1);
        }
    });

    eventRect.on("mouseleave", () => {
        eventRect.style("cursor", "grab");
        crosshair.style("opacity", 0);
        tooltip.style("opacity", 0);
        paths.attr("opacity", 0.8).attr("stroke", "none");
        d3.selectAll(".legend-item").attr("opacity", 1);
    });

    // 11. Custom HTML/SVG Legend Overlay
    const legend = svg.append("g").attr("transform", `translate(40, 20)`);
    topics.forEach((topic, i) => {
        const lg = legend.append("g")
            .attr("class", `legend-item legend-item-${i}`)
            .attr("transform", `translate(${i * (containerWidth/topics.length - 10)}, 0)`)
            .style("cursor", "pointer")
            .style("transition", "opacity 0.2s ease")
            .on("mouseover", () => {
                paths.attr("opacity", (d, idx) => idx === i ? 1 : 0.15)
                     .attr("stroke", (d, idx) => idx === i ? "#fff" : "none")
                     .attr("stroke-width", (d, idx) => idx === i ? 2 : 0);
                d3.selectAll(".legend-item").attr("opacity", (d, idx) => idx === i ? 1 : 0.3);
            })
            .on("mouseout", () => {
                paths.attr("opacity", 0.8).attr("stroke", "none");
                d3.selectAll(".legend-item").attr("opacity", 1);
            });
        lg.append("rect").attr("width", 12).attr("height", 12).attr("fill", palette[i % palette.length]).attr("rx", 3);
        lg.append("text").attr("x", 20).attr("y", 10).attr("fill", "var(--text-primary)").style("font-size", "12px").text(topic);
    });
}

// --------------------------------------------------------
// Module 4: Citation Mapping
// "연구자 및 학문 공동체 맵핑 (저자-학술지-담론 간의 네트워크 지형)"
// --------------------------------------------------------
function renderCitationMap(data, palette) {
    const container = d3.select("#citationContainer");
    container.html("");
    const width = container.node().getBoundingClientRect().width;
    const height = 400;

    const linksMap = new Map();
    const nodes = {};

    data.forEach(d => {
        if (d.authors && d.authors.length > 0 && d.journal) {
            const author = d.authors[0].name.trim(); 
            const journal = d.journal.trim();
            if(!author || !journal) return;

            if (!nodes[author]) nodes[author] = { id: author, type: 'author', degree: 0 };
            if (!nodes[journal]) nodes[journal] = { id: journal, type: 'journal', degree: 0 };
            
            const key = `${author}::${journal}`;
            if (linksMap.has(key)) linksMap.get(key).value++;
            else linksMap.set(key, { source: author, target: journal, value: 1 });
        }
    });

    const links = Array.from(linksMap.values()).filter(l => l.value >= 1); // threshold if needed
    links.forEach(l => {
        nodes[l.source].degree += l.value;
        nodes[l.target].degree += l.value;
    });

    const nodeArray = Object.values(nodes);
    
    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.2, 4]).on("zoom", (e) => g.attr("transform", e.transform)));

    const simulation = d3.forceSimulation(nodeArray)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value)))
        .attr("stroke-opacity", 0.3)
        .attr("stroke", "var(--text-secondary)");

    const node = g.append("g")
        .selectAll("path")
        .data(nodeArray)
        .join("path")
        // author: circle, journal: square
        .attr("d", d => d3.symbol().type(d.type === 'journal' ? d3.symbolSquare : d3.symbolCircle).size(d.type === 'journal' ? Math.max(100, d.degree * 30) : Math.max(40, d.degree * 20))())
        .attr("fill", d => d.type === 'journal' ? palette[1] : palette[4])
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .call(drag(simulation));

    node.append("title").text(d => `${d.id} (${d.type === 'journal' ? '학술지' : '저자'}, 출판수: ${d.degree})`);

    const label = g.append("g")
        .selectAll("text")
        .data(nodeArray.filter(d => d.type === 'journal' || d.degree > 2))
        .join("text")
        .attr("dx", d => d.type === 'journal' ? 10 : 8)
        .attr("dy", 4)
        .text(d => d.id)
        .style("fill", d => d.type === 'journal' ? "var(--text-primary)" : "var(--text-secondary)")
        .style("font-size", d => d.type === 'journal' ? "12px" : "10px")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });
}

function drag(simulation) {
    function started(e) { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; }
    function dragged(e) { e.subject.fx = e.x; e.subject.fy = e.y; }
    function ended(e) { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; }
    return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
}
