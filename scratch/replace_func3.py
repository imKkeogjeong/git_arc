import io, re

new_func = """function renderTopicStreamgraph(data, palette) {
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
}"""

with io.open('KCI_Dashboard/app_v7.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'function renderTopicStreamgraph\(data, palette\) \{.*?\}(?=\n\n// --------------------------------------------------------\n// Module 4)', re.DOTALL)
new_content = pattern.sub(new_func, content)

with io.open('KCI_Dashboard/app_v7.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
