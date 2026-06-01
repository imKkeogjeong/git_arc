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
    const width = container.node().getBoundingClientRect().width;
    const height = 350;

    const topics = ["개체화/생성", "기술철학/기계", "예술/미디어", "윤리/사회", "존재론/형이상학"];
    const yearDataMap = {};

    data.forEach(d => {
        // Filter out corrupted years (e.g. 186000)
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

    const years = Object.keys(yearDataMap).map(Number).sort();
    if(years.length === 0) return;
    
    // Fill missing years for smooth curve
    const minYear = years[0];
    const maxYear = years[years.length-1];
    for(let y = minYear; y <= maxYear; y++) {
        if(!yearDataMap[y]) {
            yearDataMap[y] = { year: y };
            topics.forEach(t => yearDataMap[y][t] = 0);
        }
    }
    const fullYears = Object.keys(yearDataMap).map(Number).sort();
    const streamData = fullYears.map(y => yearDataMap[y]);

    const stack = d3.stack().keys(topics).offset(d3.stackOffsetWiggle);
    const layers = stack(streamData);

    const svg = container.append("svg").attr("viewBox", [0, 0, width, height]);

    const x = d3.scaleLinear().domain(d3.extent(fullYears)).range([40, width - 40]);
    const y = d3.scaleLinear()
        .domain([d3.min(layers, l => d3.min(l, d => d[0])), d3.max(layers, l => d3.max(l, d => d[1]))])
        .range([height - 40, 40]);

    // Clip path to prevent drawing outside bounds when panning/zooming
    svg.append("defs").append("clipPath")
        .attr("id", "stream-clip")
        .append("rect")
        .attr("x", 40)
        .attr("y", 0)
        .attr("width", width - 80)
        .attr("height", height - 30);

    // Invisible rect to capture zoom/pan events over the entire SVG area
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("pointer-events", "all");

    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    const chartGroup = svg.append("g").attr("clip-path", "url(#stream-clip)");

    const paths = chartGroup.selectAll("path")
        .data(layers)
        .join("path")
        .attr("class", (d, i) => `stream-path stream-${i}`)
        .attr("d", area)
        .attr("fill", (d, i) => palette[i % palette.length])
        .attr("opacity", 0.8)
        .style("transition", "all 0.2s ease")
        .on("mouseover", function(event, d) {
            const i = layers.indexOf(d);
            // Highlight current path, outline it
            d3.selectAll(".stream-path").attr("opacity", 0.2).attr("stroke", "none");
            d3.select(this).attr("opacity", 1).attr("stroke", "var(--text-primary)").attr("stroke-width", 1.5);
            // Highlight legend
            d3.selectAll(".legend-item").attr("opacity", 0.4);
            d3.select(`.legend-item-${i}`).attr("opacity", 1);
        })
        .on("mouseout", function() {
            d3.selectAll(".stream-path").attr("opacity", 0.8).attr("stroke", "none");
            d3.selectAll(".legend-item").attr("opacity", 1);
        });

    paths.append("title").text((d, i) => topics[i]);

    const xAxisGroup = svg.append("g")
        .attr("transform", `translate(0,${height - 30})`)
        .attr("color", "var(--text-secondary)");

    const xAxis = d3.axisBottom(x).ticks(Math.min(10, fullYears.length)).tickFormat(d3.format("d"));
    xAxisGroup.call(xAxis);

    // Zoom and Pan behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [Math.max(width, 400), height]])
        .extent([[40, 0], [Math.max(width, 400) - 40, height]])
        .on("zoom", (event) => {
            const newX = event.transform.rescaleX(x);
            area.x(d => newX(d.data.year));
            paths.attr("d", area);
            xAxisGroup.call(xAxis.scale(newX));
        });

    svg.call(zoom);

    // Add cursor style for grabbing
    svg.style("cursor", "grab");
    svg.on("mousedown", () => svg.style("cursor", "grabbing"));
    svg.on("mouseup", () => svg.style("cursor", "grab"));

    const legend = svg.append("g").attr("transform", `translate(40, 20)`);
    topics.forEach((topic, i) => {
        const lg = legend.append("g")
            .attr("class", `legend-item legend-item-${i}`)
            .attr("transform", `translate(${i * (width/topics.length - 10)}, 0)`)
            .style("cursor", "pointer")
            .style("transition", "opacity 0.2s ease")
            .on("mouseover", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.2).attr("stroke", "none");
                d3.select(`.stream-${i}`).attr("opacity", 1).attr("stroke", "var(--text-primary)").attr("stroke-width", 1.5);
                d3.selectAll(".legend-item").attr("opacity", 0.4);
                d3.select(`.legend-item-${i}`).attr("opacity", 1);
            })
            .on("mouseout", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.8).attr("stroke", "none");
                d3.selectAll(".legend-item").attr("opacity", 1);
            });
        lg.append("rect").attr("width", 12).attr("height", 12).attr("fill", palette[i]);
        lg.append("text").attr("x", 18).attr("y", 10).attr("fill", "var(--text-primary)").style("font-size", "11px").text(topic);
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
