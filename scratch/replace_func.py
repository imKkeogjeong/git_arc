import io, re

new_func = """function renderTopicStreamgraph(data, palette) {
    const container = d3.select("#streamContainer");
    container.html("");
    const width = container.node().getBoundingClientRect().width || 1000;
    const height = 500; // Increased height for better readability

    const topics = ["개체화/생성", "기술철학/기계", "예술/미디어", "윤리/사회", "존재론/형이상학"];
    const yearDataMap = {};

    data.forEach(d => {
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
    
    // Fill missing years
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

    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", "100%")
        .style("max-height", "500px");

    // Make internal graph wider if data is large to prevent dense packing
    const innerWidth = Math.max(width, 1200);

    const x = d3.scaleLinear().domain(d3.extent(fullYears)).range([40, innerWidth - 40]);
    const y = d3.scaleLinear()
        .domain([d3.min(layers, l => d3.min(l, d => d[0])), d3.max(layers, l => d3.max(l, d => d[1]))])
        .range([height - 50, 60]);

    // Clip path to prevent drawing outside bounds when panning/zooming
    svg.append("defs").append("clipPath")
        .attr("id", "stream-clip")
        .append("rect")
        .attr("x", 40)
        .attr("y", 0)
        .attr("width", innerWidth - 80)
        .attr("height", height - 30);

    // Invisible rect to capture zoom/pan events over the entire SVG area
    const zoomRect = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .style("cursor", "grab");

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
            d3.selectAll(".stream-path").attr("opacity", 0.15).attr("stroke", "none");
            d3.select(this).attr("opacity", 1).attr("stroke", "var(--text-primary)").attr("stroke-width", 2);
            // Highlight legend
            d3.selectAll(".legend-item").attr("opacity", 0.3);
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

    // Every 2 years to prevent overlapping, explicit tick formatting
    const tickVals = fullYears.filter(y => y % 2 === 0);
    const xAxis = d3.axisBottom(x).tickValues(tickVals).tickFormat(d => String(d));
    xAxisGroup.call(xAxis);
    xAxisGroup.selectAll("text").style("font-size", "12px");

    // Zoom and Pan behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [innerWidth, height]])
        .extent([[40, 0], [width - 40, height]])
        .on("zoom", (event) => {
            const newX = event.transform.rescaleX(x);
            area.x(d => newX(d.data.year));
            paths.attr("d", area);
            xAxisGroup.call(xAxis.scale(newX));
            xAxisGroup.selectAll("text").style("font-size", "12px");
        });

    svg.call(zoom);

    // Add cursor style for grabbing
    zoomRect.on("mousedown", () => zoomRect.style("cursor", "grabbing"));
    zoomRect.on("mouseup", () => zoomRect.style("cursor", "grab"));
    zoomRect.on("mouseleave", () => zoomRect.style("cursor", "grab"));

    const legend = svg.append("g").attr("transform", `translate(40, 20)`);
    topics.forEach((topic, i) => {
        const lg = legend.append("g")
            .attr("class", `legend-item legend-item-${i}`)
            .attr("transform", `translate(${i * (width/topics.length - 10)}, 0)`)
            .style("cursor", "pointer")
            .style("transition", "opacity 0.2s ease")
            .on("mouseover", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.15).attr("stroke", "none");
                d3.select(`.stream-${i}`).attr("opacity", 1).attr("stroke", "var(--text-primary)").attr("stroke-width", 2);
                d3.selectAll(".legend-item").attr("opacity", 0.3);
                d3.select(`.legend-item-${i}`).attr("opacity", 1);
            })
            .on("mouseout", () => {
                d3.selectAll(".stream-path").attr("opacity", 0.8).attr("stroke", "none");
                d3.selectAll(".legend-item").attr("opacity", 1);
            });
        lg.append("rect").attr("width", 12).attr("height", 12).attr("fill", palette[i % palette.length]);
        lg.append("text").attr("x", 18).attr("y", 10).attr("fill", "var(--text-primary)").style("font-size", "12px").text(topic);
    });
}"""

with io.open('KCI_Dashboard/app_v7.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'function renderTopicStreamgraph\(data, palette\) \{.*?\}(?=\n\n// --------------------------------------------------------\n// Module 4)', re.DOTALL)
new_content = pattern.sub(new_func, content)

with io.open('KCI_Dashboard/app_v7.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
