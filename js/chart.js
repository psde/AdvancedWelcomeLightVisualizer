let chartInstances = [];
let summaryChartInstances = [];

function parseForChart(seq) {
  if (!seq || seq.identifier === RAW_IDENTIFIER) {
    return { maxT: 0, points: [] };
  }
  let sumT = 0;
  const points = [];

  points.push({ t: 0, b: 0 });

  for (let i = 0; i < seq.data.length; i += 2) {
    const durationHex = parseInt(seq.data[i], 16) || 0;
    const brightnessHex = parseInt(seq.data[i + 1], 16) || 0;
    // Real-world validation: 60fps recordings confirmed ×20 multiplier (BMW G20 2020)
    sumT += durationHex * 20;
    const bri = Math.min(brightnessHex, 100);
    points.push({ t: sumT, b: bri });
  }

  return { maxT: sumT, points };
}

function arePointsIdentical(leftPoints, rightPoints) {
  if (leftPoints.length !== rightPoints.length) return false;
  for (let i = 0; i < leftPoints.length; i++) {
    if (leftPoints[i].t !== rightPoints[i].t || leftPoints[i].b !== rightPoints[i].b) return false;
  }
  return true;
}

function getChannelPhaseOffset(seqIndex) {
  if (!currentPhaseTimeline) return 0;
  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const seq = leftSeq || rightSeq;
  if (!seq || seq.identifier === RAW_IDENTIFIER) return 0;

  const chId = parseInt(seq.identifier, 16);
  const phaseIdx = currentPhaseTimeline.channelPhaseMap[chId];
  if (phaseIdx === undefined) return 0;

  return currentPhaseTimeline.phases[phaseIdx].start;
}

function getChartMaxTime(localMaxT) {
  if (currentPhaseTimeline) {
    return Math.max(currentPhaseTimeline.totalDuration, localMaxT);
  }
  return localMaxT;
}

function getPhysicalLightIds(config) {
  if (!config || !config.channels) return [];
  const ids = [];
  for (const ch of config.channels) {
    if (!ch.physicalLight && (ch.shapes || ch.type)) {
      ids.push(ch.id);
    }
  }
  return ids;
}

// ============================================================================
// SVG Chart Rendering
// ============================================================================

function getChartData(seqIndex) {
  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const leftData = parseForChart(leftSeq);
  const rightData = parseForChart(rightSeq);

  // Apply phase time offset
  const phaseOffset = getChannelPhaseOffset(seqIndex);
  if (phaseOffset > 0) {
    leftData.points = leftData.points.map(p => ({ t: p.t + phaseOffset, b: p.b }));
    leftData.maxT += phaseOffset;
    rightData.points = rightData.points.map(p => ({ t: p.t + phaseOffset, b: p.b }));
    rightData.maxT += phaseOffset;
  }

  // Apply default brightness to initial point for physicalLight channels
  if (currentPhaseTimeline) {
    const seq = leftSeq || rightSeq;
    if (seq && seq.identifier !== RAW_IDENTIFIER) {
      const chId = parseInt(seq.identifier, 16);
      const vehicleKey = document.getElementById("vehicleSelect").value;
      const config = VEHICLE_CONFIGS[vehicleKey];
      if (config) {
        const chConfig = config.channels && config.channels.find(c => c.id === chId);
        if (chConfig && chConfig.physicalLight && config.defaultStates) {
          const defaultBri = (config.defaultStates[chConfig.physicalLight] || {}).brightness || 0;
          if (leftData.points.length > 0) leftData.points[0].b = defaultBri;
          if (rightData.points.length > 0) rightData.points[0].b = defaultBri;
        }
      }
    }
  }

  const localMax = Math.max(leftData.maxT, rightData.maxT);
  const maxTime = getChartMaxTime(localMax) || 1000;

  return { leftData, rightData, maxTime };
}

function getDefaultBrightnessLines(seqIndex) {
  const lines = [];
  if (!currentPhaseTimeline) return lines;

  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const seq = leftSeq || rightSeq;
  if (!seq || seq.identifier === RAW_IDENTIFIER) return lines;

  const chId = parseInt(seq.identifier, 16);
  const vehicleKey = document.getElementById("vehicleSelect").value;
  const config = VEHICLE_CONFIGS[vehicleKey];
  if (!config) return lines;

  // Direct default brightness for this channel
  if (config.defaultStates && config.defaultStates[chId]) {
    lines.push(config.defaultStates[chId].brightness);
  }

  // PhysicalLight default brightness
  const chConfig = config.channels && config.channels.find(c => c.id === chId);
  if (chConfig && chConfig.physicalLight && config.defaultStates) {
    const defaultBri = (config.defaultStates[chConfig.physicalLight] || {}).brightness || 0;
    if (defaultBri > 0 && !lines.includes(defaultBri)) {
      lines.push(defaultBri);
    }
  }

  return lines;
}

function createSequenceChart(seqIndex, containerDiv) {
  // Wrapper for relative positioning of overlay controls
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', TL_HEIGHT);

  // Groups in render order (bottom to top)
  const gridGroup = createSVGGroup(svg, 'tl-grid');
  const fillGroup = createSVGGroup(svg, 'chart-fill');
  const phaseBoundaryGroup = createSVGGroup(svg, 'chart-phase-boundaries');
  const refLineGroup = createSVGGroup(svg, 'chart-ref-lines');
  const curveGroup = createSVGGroup(svg, 'chart-curves');
  const focusedStepGroup = createSVGGroup(svg, 'chart-focused-step');
  const positionGroup = createSVGGroup(svg, 'chart-position');
  const handlesGroup = createSVGGroup(svg, 'tl-handles');
  handlesGroup.style.display = 'none';

  wrapper.appendChild(svg);

  // Floating edit controls overlay
  const controls = document.createElement('div');
  controls.className = 'chart-edit-controls';

  const editBtn = document.createElement('button');
  editBtn.className = 'chart-edit-toggle';
  editBtn.textContent = 'Edit';
  editBtn.title = 'Toggle edit mode';
  controls.appendChild(editBtn);

  // Side selector (hidden until edit mode active)
  const sideSelector = document.createElement('div');
  sideSelector.className = 'chart-side-selector';
  sideSelector.style.display = 'none';
  for (const opt of ['L', 'R', 'L+R']) {
    const btn = document.createElement('button');
    btn.className = 'chart-side-btn';
    btn.dataset.editSide = opt === 'L' ? 'left' : opt === 'R' ? 'right' : 'both';
    btn.textContent = opt;
    if (opt === 'L+R') btn.classList.add('active');
    sideSelector.appendChild(btn);
  }
  controls.appendChild(sideSelector);

  wrapper.appendChild(controls);
  containerDiv.appendChild(wrapper);

  const state = {
    svg,
    wrapper,
    gridGroup,
    fillGroup,
    phaseBoundaryGroup,
    refLineGroup,
    curveGroup,
    focusedStepGroup,
    positionGroup,
    handlesGroup,
    seqIndex,
    maxTime: 1000,
    plotWidth: 0,
    plotHeight: TL_HEIGHT - 2 * TL_MARGIN,
    positionLine: null,
    positionTriangle: null,
    editMode: false,   // false, 'left', 'right', or 'both'
    lastRenderedWidth: 0
  };

  // Wire edit button
  editBtn.onclick = () => toggleChartEditMode(seqIndex);

  // Wire side selector buttons
  sideSelector.querySelectorAll('.chart-side-btn').forEach(btn => {
    btn.onclick = () => {
      sideSelector.querySelectorAll('.chart-side-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.editMode = btn.dataset.editSide;
      const svgWidth = svg.getBoundingClientRect().width;
      if (svgWidth > 0) renderSequenceChartContent(state, svgWidth);
      wireChartEditInteractions(state);
    };
  });

  // Initial render
  requestAnimationFrame(() => {
    const svgWidth = svg.getBoundingClientRect().width;
    if (svgWidth > 0) {
      renderSequenceChartContent(state, svgWidth);
    }
  });

  // Resize handling
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const newWidth = Math.round(entry.contentRect.width);
      if (newWidth > 0 && newWidth !== state.lastRenderedWidth) {
        renderSequenceChartContent(state, newWidth);
      }
    }
  });
  resizeObserver.observe(wrapper);

  const mutObserver = new MutationObserver(() => {
    if (!containerDiv.contains(wrapper)) {
      resizeObserver.disconnect();
      mutObserver.disconnect();
    }
  });
  mutObserver.observe(containerDiv, { childList: true });

  // Click-to-seek (only when not in edit mode)
  let isSeekDragging = false;
  svg.addEventListener('mousedown', (e) => {
    if (state.editMode) return;
    isSeekDragging = true;
    handleChartSeek(e, state);
  });
  svg.addEventListener('mousemove', (e) => {
    if (isSeekDragging && !state.editMode) handleChartSeek(e, state);
  });
  document.addEventListener('mouseup', () => { isSeekDragging = false; });

  return state;
}

function handleChartSeek(e, state) {
  const svgRect = state.svg.getBoundingClientRect();
  const localX = e.clientX - svgRect.left;
  if (localX < TL_MARGIN || localX > TL_MARGIN + state.plotWidth) return;

  const clickedTime = xToTime(localX, state.maxTime, state.plotWidth);
  const clampedTime = Math.max(0, Math.min(state.maxTime, clickedTime));
  seekAnimation(clampedTime);

  // Focus light elements
  const seq = sideData.left.sequences[state.seqIndex] || sideData.right.sequences[state.seqIndex];
  for (const side of ['left', 'right']) {
    const el = getLightElement(side, seq, state.seqIndex);
    if (el) el.classList.add('focused');
  }
  document.addEventListener('mouseup', function clearFocus() {
    for (const side of ['left', 'right']) {
      const el = getLightElement(side, seq, state.seqIndex);
      if (el) el.classList.remove('focused');
    }
    document.removeEventListener('mouseup', clearFocus);
  }, { once: true });
}

function renderSequenceChartContent(state, svgWidth) {
  state.lastRenderedWidth = Math.round(svgWidth);
  const plotWidth = svgWidth - 2 * TL_MARGIN;
  const plotHeight = TL_HEIGHT - 2 * TL_MARGIN;
  state.plotWidth = plotWidth;
  state.plotHeight = plotHeight;

  const { leftData, rightData, maxTime } = getChartData(state.seqIndex);
  state.maxTime = maxTime;

  // Clear all groups
  state.gridGroup.innerHTML = '';
  state.fillGroup.innerHTML = '';
  state.phaseBoundaryGroup.innerHTML = '';
  state.refLineGroup.innerHTML = '';
  state.curveGroup.innerHTML = '';
  state.focusedStepGroup.innerHTML = '';
  state.positionGroup.innerHTML = '';
  state.handlesGroup.innerHTML = '';

  // Grid
  drawTimelineGrid(state.gridGroup, plotWidth, plotHeight, maxTime);

  // Phase boundaries
  drawSVGPhaseBoundaries(state.phaseBoundaryGroup, plotWidth, plotHeight, maxTime);

  // Default brightness reference lines
  const refLines = getDefaultBrightnessLines(state.seqIndex);
  for (const bri of refLines) {
    drawSVGDefaultBrightnessLine(state.refLineGroup, plotWidth, plotHeight, bri);
  }

  // Fill polygons (translucent)
  drawChartFill(state.fillGroup, leftData.points, maxTime, plotWidth, plotHeight, '#0000ff');
  drawChartFill(state.fillGroup, rightData.points, maxTime, plotWidth, plotHeight, '#ff0000');

  // Overlay curves with segment-level L/R color coding
  drawOverlayCurves(state.curveGroup, leftData.points, rightData.points, maxTime, plotWidth, plotHeight);

  // Position indicator (created once, updated per frame)
  state.positionLine = appendSVGLine(state.positionGroup, 0, TL_MARGIN, 0, TL_MARGIN + plotHeight, '#333', 2);
  state.positionLine.style.display = 'none';
  state.positionTriangle = document.createElementNS(SVG_NS, 'polygon');
  state.positionTriangle.setAttribute('fill', '#333');
  state.positionTriangle.style.display = 'none';
  state.positionGroup.appendChild(state.positionTriangle);

  // Edit handles (visible only in edit mode)
  if (state.editMode) {
    state.handlesGroup.style.display = '';
    drawChartHandles(state.handlesGroup, leftData.points, rightData.points, maxTime, plotWidth, plotHeight, state.seqIndex, state.editMode);
  }

  // Update position indicator to current time
  updateChartPositionIndicator(state, currentAnimTime);
}

function drawChartFill(group, points, maxTime, plotWidth, plotHeight, color) {
  if (points.length < 2) return;

  const polyPoints = [];
  for (const p of points) {
    polyPoints.push(`${timeToX(p.t, maxTime, plotWidth)},${brightnessToY(p.b, plotHeight)}`);
  }
  polyPoints.push(`${timeToX(points[points.length - 1].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);
  polyPoints.push(`${timeToX(points[0].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);

  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', polyPoints.join(' '));
  polygon.setAttribute('fill', color);
  polygon.setAttribute('fill-opacity', '0.07');
  polygon.setAttribute('stroke', 'none');
  polygon.classList.add('chart-fill-area');
  group.appendChild(polygon);
}

function drawOverlayCurves(group, leftPts, rightPts, maxTime, plotWidth, plotHeight) {
  const identical = arePointsIdentical(leftPts, rightPts);

  if (identical) {
    // Draw single green polyline
    drawChartPolyline(group, leftPts, maxTime, plotWidth, plotHeight, '#00b400', 2);
    return;
  }

  // Per-segment comparison: green where both match, blue for left, red for right
  const maxPts = Math.max(leftPts.length, rightPts.length);

  for (let s = 0; s < maxPts - 1; s++) {
    const lHas = s + 1 < leftPts.length;
    const rHas = s + 1 < rightPts.length;
    const bothMatch = lHas && rHas &&
      leftPts[s].t === rightPts[s].t && leftPts[s].b === rightPts[s].b &&
      leftPts[s + 1].t === rightPts[s + 1].t && leftPts[s + 1].b === rightPts[s + 1].b;

    if (bothMatch) {
      drawChartSegment(group, leftPts[s], leftPts[s + 1], maxTime, plotWidth, plotHeight, '#00b400', 2);
    } else {
      if (lHas) drawChartSegment(group, leftPts[s], leftPts[s + 1], maxTime, plotWidth, plotHeight, '#0000ff', 2);
      if (rHas) drawChartSegment(group, rightPts[s], rightPts[s + 1], maxTime, plotWidth, plotHeight, '#ff0000', 2);
    }
  }
}

function drawChartPolyline(group, points, maxTime, plotWidth, plotHeight, color, strokeWidth) {
  if (points.length < 2) return;
  const linePoints = points.map(p =>
    `${timeToX(p.t, maxTime, plotWidth)},${brightnessToY(p.b, plotHeight)}`
  ).join(' ');

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('points', linePoints);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', strokeWidth);
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.classList.add('chart-curve');
  group.appendChild(polyline);
}

function drawChartSegment(group, p1, p2, maxTime, plotWidth, plotHeight, color, strokeWidth) {
  const x1 = timeToX(p1.t, maxTime, plotWidth);
  const y1 = brightnessToY(p1.b, plotHeight);
  const x2 = timeToX(p2.t, maxTime, plotWidth);
  const y2 = brightnessToY(p2.b, plotHeight);

  const line = appendSVGLine(group, x1, y1, x2, y2, color, strokeWidth);
  line.classList.add('chart-curve');
  return line;
}

function drawSVGPhaseBoundaries(group, plotWidth, plotHeight, maxTime) {
  if (!currentPhaseTimeline) return;

  for (const phase of currentPhaseTimeline.phases) {
    for (const boundary of [phase.start, phase.end]) {
      if (boundary <= 0 || boundary >= maxTime) continue;

      const x = timeToX(boundary, maxTime, plotWidth);
      const line = appendSVGLine(group, x, TL_MARGIN, x, TL_MARGIN + plotHeight, '#b46464', 1);
      line.setAttribute('stroke-dasharray', '5,5');
      line.classList.add('chart-phase-line');
    }

    const midX = timeToX((phase.start + phase.end) / 2, maxTime, plotWidth);
    const label = appendSVGText(group, midX, TL_MARGIN - 4, phase.name, 'middle', '9px', '#b46464');
    label.classList.add('chart-phase-label');
  }
}

function drawSVGDefaultBrightnessLine(group, plotWidth, plotHeight, brightness) {
  const y = brightnessToY(brightness, plotHeight);
  const line = appendSVGLine(group, TL_MARGIN, y, TL_MARGIN + plotWidth, y, '#999', 1);
  line.setAttribute('stroke-dasharray', '3,3');
  line.classList.add('chart-ref-line');
}

function drawChartHandles(group, leftPts, rightPts, maxTime, plotWidth, plotHeight, seqIndex, editSide) {
  const showLeft = editSide === 'left' || editSide === 'both';
  const showRight = editSide === 'right' || editSide === 'both';

  if (editSide === 'both') {
    // When editing both: merge identical points into combined handles
    const maxLen = Math.max(leftPts.length, rightPts.length);
    for (let i = 0; i < maxLen; i++) {
      const lPt = i < leftPts.length ? leftPts[i] : null;
      const rPt = i < rightPts.length ? rightPts[i] : null;
      const bothExist = lPt && rPt;
      const identical = bothExist && lPt.t === rPt.t && lPt.b === rPt.b;

      if (identical) {
        // Combined handle — green, moves both sides
        drawSingleHandle(group, lPt, i, 'both', seqIndex, maxTime, plotWidth, plotHeight, '#00b400');
      } else {
        if (lPt) drawSingleHandle(group, lPt, i, 'left', seqIndex, maxTime, plotWidth, plotHeight, '#0000ff');
        if (rPt) drawSingleHandle(group, rPt, i, 'right', seqIndex, maxTime, plotWidth, plotHeight, '#ff0000');
      }
    }
  } else {
    if (showLeft) {
      for (let i = 0; i < leftPts.length; i++) {
        drawSingleHandle(group, leftPts[i], i, 'left', seqIndex, maxTime, plotWidth, plotHeight, '#0000ff');
      }
    }
    if (showRight) {
      for (let i = 0; i < rightPts.length; i++) {
        drawSingleHandle(group, rightPts[i], i, 'right', seqIndex, maxTime, plotWidth, plotHeight, '#ff0000');
      }
    }
  }
}

function drawSingleHandle(group, point, index, side, seqIndex, maxTime, plotWidth, plotHeight, color) {
  const cx = timeToX(point.t, maxTime, plotWidth);
  const cy = brightnessToY(point.b, plotHeight);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('data-point-index', index);
  circle.setAttribute('data-side', side);
  circle.setAttribute('data-seq-index', seqIndex);

  if (index === 0) {
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#999');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1');
    circle.classList.add('tl-origin');
  } else {
    circle.setAttribute('r', TL_HANDLE_RADIUS);
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2');
    circle.classList.add('tl-handle');
  }

  group.appendChild(circle);
}

// ============================================================================
// Focused Step Highlight (direct DOM update, no polling)
// ============================================================================

function showFocusedStepOnChart(seqIndex, side, stepIndex) {
  const chart = chartInstances[seqIndex];
  if (!chart) return;

  const { leftData, rightData, maxTime } = getChartData(seqIndex);
  const pts = side === 'left' ? leftData.points : rightData.points;
  const pointIdx = stepIndex + 1; // points[0] is initial {t:0, b:0}

  if (pointIdx < 1 || pointIdx >= pts.length) return;

  const group = chart.focusedStepGroup;
  group.innerHTML = '';

  const plotWidth = chart.plotWidth;
  const plotHeight = chart.plotHeight;

  const pStart = pts[pointIdx - 1];
  const pEnd = pts[pointIdx];

  const x1 = timeToX(pStart.t, maxTime, plotWidth);
  const y1 = brightnessToY(pStart.b, plotHeight);
  const x2 = timeToX(pEnd.t, maxTime, plotWidth);
  const y2 = brightnessToY(pEnd.b, plotHeight);

  const sideColor = side === 'left' ? '#0000ff' : '#ff0000';

  // Thick highlighted segment
  appendSVGLine(group, x1, y1, x2, y2, sideColor, 4);

  // Crosshair dashed lines from end point to axes
  const hLine = appendSVGLine(group, x2, TL_MARGIN + plotHeight, x2, y2, 'rgba(100,100,100,0.47)', 1);
  hLine.setAttribute('stroke-dasharray', '3,3');
  const vLine = appendSVGLine(group, TL_MARGIN, y2, x2, y2, 'rgba(100,100,100,0.47)', 1);
  vLine.setAttribute('stroke-dasharray', '3,3');

  // Dot at end point
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', x2);
  dot.setAttribute('cy', y2);
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', sideColor);
  dot.setAttribute('stroke', '#fff');
  dot.setAttribute('stroke-width', '2');
  group.appendChild(dot);

  // Value label
  const timeLabel = formatStepTime(pEnd.t);
  appendSVGText(group, x2 + 8, y2 - 6, `${timeLabel}, ${pEnd.b}%`, 'start', '10px', '#333');
}

function clearFocusedStepOnChart(seqIndex) {
  const chart = chartInstances[seqIndex];
  if (!chart) return;
  chart.focusedStepGroup.innerHTML = '';
}

// ============================================================================
// Position Indicator Updates
// ============================================================================

function updateChartPositionIndicator(state, time) {
  if (!state || !state.positionLine) return;

  const x = timeToX(time, state.maxTime, state.plotWidth);
  if (x >= TL_MARGIN && x <= TL_MARGIN + state.plotWidth) {
    state.positionLine.setAttribute('x1', x);
    state.positionLine.setAttribute('x2', x);
    state.positionLine.style.display = '';

    state.positionTriangle.setAttribute('points',
      `${x},${TL_MARGIN + state.plotHeight} ${x - 5},${TL_MARGIN + state.plotHeight + 10} ${x + 5},${TL_MARGIN + state.plotHeight + 10}`);
    state.positionTriangle.style.display = '';
  } else {
    state.positionLine.style.display = 'none';
    state.positionTriangle.style.display = 'none';
  }
}

function updateAllChartPositionIndicators(time) {
  for (const chart of chartInstances) {
    updateChartPositionIndicator(chart, time);
  }
  for (const chart of summaryChartInstances) {
    updateChartPositionIndicator(chart, time);
  }
}

// ============================================================================
// Update (re-render) a single sequence chart in-place
// ============================================================================

function updateSequenceChart(seqIndex) {
  const chart = chartInstances[seqIndex];
  if (!chart) return;

  const svgWidth = chart.svg.getBoundingClientRect().width;
  if (svgWidth > 0) {
    renderSequenceChartContent(chart, svgWidth);
  }
}

// ============================================================================
// Summary Charts (SVG, read-only)
// ============================================================================

function createSummaryChart(physicalChId, containerDiv, config) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'chart-svg summary-chart-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', TL_HEIGHT);

  const gridGroup = createSVGGroup(svg, 'tl-grid');
  const refLineGroup = createSVGGroup(svg, 'chart-ref-lines');
  const boundaryGroup = createSVGGroup(svg, 'chart-phase-boundaries');
  const curveGroup = createSVGGroup(svg, 'chart-curves');
  const legendGroup = createSVGGroup(svg, 'chart-legend');
  const positionGroup = createSVGGroup(svg, 'chart-position');

  containerDiv.appendChild(svg);

  const state = {
    svg,
    gridGroup,
    refLineGroup,
    boundaryGroup,
    curveGroup,
    legendGroup,
    positionGroup,
    physicalChId,
    config,
    maxTime: 1000,
    plotWidth: 0,
    plotHeight: TL_HEIGHT - 2 * TL_MARGIN,
    positionLine: null,
    positionTriangle: null,
    lastRenderedWidth: 0
  };

  requestAnimationFrame(() => {
    const svgWidth = svg.getBoundingClientRect().width;
    if (svgWidth > 0) {
      renderSummaryChartContent(state, svgWidth);
    }
  });

  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const newWidth = Math.round(entry.contentRect.width);
      if (newWidth > 0 && newWidth !== state.lastRenderedWidth) {
        renderSummaryChartContent(state, newWidth);
      }
    }
  });
  resizeObserver.observe(containerDiv);

  const mutObserver = new MutationObserver(() => {
    if (!containerDiv.contains(svg)) {
      resizeObserver.disconnect();
      mutObserver.disconnect();
    }
  });
  mutObserver.observe(containerDiv, { childList: true });

  // Click-to-seek
  let isDragging = false;
  const seekHandler = (e) => {
    const svgRect = svg.getBoundingClientRect();
    const localX = e.clientX - svgRect.left;
    if (localX < TL_MARGIN || localX > TL_MARGIN + state.plotWidth) return;
    const clickedTime = xToTime(localX, state.maxTime, state.plotWidth);
    seekAnimation(Math.max(0, Math.min(state.maxTime, clickedTime)));

    const els = ['left', 'right'].map(s => document.getElementById(`${s}_light_ch${physicalChId}`)).filter(Boolean);
    for (const el of els) el.classList.add('focused');
    document.addEventListener('mouseup', function clear() {
      for (const el of els) el.classList.remove('focused');
      document.removeEventListener('mouseup', clear);
    }, { once: true });
  };
  svg.addEventListener('mousedown', (e) => { isDragging = true; seekHandler(e); });
  svg.addEventListener('mousemove', (e) => { if (isDragging) seekHandler(e); });
  document.addEventListener('mouseup', () => { isDragging = false; });

  return state;
}

function renderSummaryChartContent(state, svgWidth) {
  state.lastRenderedWidth = Math.round(svgWidth);
  const plotWidth = svgWidth - 2 * TL_MARGIN;
  const plotHeight = TL_HEIGHT - 2 * TL_MARGIN;
  state.plotWidth = plotWidth;
  state.plotHeight = plotHeight;

  const { physicalChId, config } = state;

  state.gridGroup.innerHTML = '';
  state.refLineGroup.innerHTML = '';
  state.boundaryGroup.innerHTML = '';
  state.curveGroup.innerHTML = '';
  state.legendGroup.innerHTML = '';
  state.positionGroup.innerHTML = '';

  if (!currentPhaseTimeline) {
    drawTimelineGrid(state.gridGroup, plotWidth, plotHeight, 1000);
    state.maxTime = 1000;
    return;
  }

  const maxTime = currentPhaseTimeline.totalDuration || 1000;
  state.maxTime = maxTime;

  drawTimelineGrid(state.gridGroup, plotWidth, plotHeight, maxTime);
  drawSVGPerLightBoundaries(state.boundaryGroup, plotWidth, plotHeight, maxTime, physicalChId, config);

  // Build sample times
  const sampleCount = Math.min(plotWidth, 500);
  const regularStep = maxTime / sampleCount;
  const sampleTimes = new Set();
  for (let i = 0; i <= sampleCount; i++) {
    sampleTimes.add(i * regularStep);
  }

  // Exact keyframe times from controlling channels
  const controllingIds = getControllingChannelsSorted(physicalChId, config, currentPhaseTimeline);
  for (const chId of controllingIds) {
    const phaseIdx = currentPhaseTimeline.channelPhaseMap[chId];
    if (phaseIdx === undefined) continue;
    const phase = currentPhaseTimeline.phases[phaseIdx];
    for (const side of ['left', 'right']) {
      const seq = findSequenceByChannelId(side, chId);
      if (!seq || seq.identifier === RAW_IDENTIFIER) continue;
      let cumTime = phase.start;
      for (let di = 0; di < seq.data.length; di += 2) {
        const durHex = parseInt(seq.data[di], 16) || 0;
        cumTime += durHex * 20;
        if (cumTime <= maxTime) sampleTimes.add(cumTime);
      }
    }
  }

  const sortedTimes = Array.from(sampleTimes).sort((a, b) => a - b);

  const leftPoints = [];
  const rightPoints = [];
  for (const t of sortedTimes) {
    leftPoints.push({
      t,
      b: getPhysicalLightBrightness(physicalChId, t, 'left', config),
      src: getPhysicalLightSource(physicalChId, t, 'left', config)
    });
    rightPoints.push({
      t,
      b: getPhysicalLightBrightness(physicalChId, t, 'right', config),
      src: getPhysicalLightSource(physicalChId, t, 'right', config)
    });
  }

  // Default brightness reference line
  const defaults = config.defaultStates || {};
  if (defaults[physicalChId]) {
    const defaultBri = defaults[physicalChId].brightness;
    if (defaultBri > 0) {
      drawSVGDefaultBrightnessLine(state.refLineGroup, plotWidth, plotHeight, defaultBri);
      const labelY = brightnessToY(defaultBri, plotHeight);
      appendSVGText(state.refLineGroup, TL_MARGIN + 3, labelY - 3, `Default: ${defaultBri}%`, 'start', '9px', '#999');
    }
  }

  // Draw summary curves with solid/dashed per source type
  drawSummaryCurves(state.curveGroup, leftPoints, rightPoints, maxTime, plotWidth, plotHeight);

  // Legend
  const hasDefault = leftPoints.some(p => isDefaultSource(p.src)) || rightPoints.some(p => isDefaultSource(p.src));
  if (hasDefault) {
    drawSummaryLegend(state.legendGroup, plotWidth, plotHeight);
  }

  // Position indicator
  state.positionLine = appendSVGLine(state.positionGroup, 0, TL_MARGIN, 0, TL_MARGIN + plotHeight, '#333', 2);
  state.positionLine.style.display = 'none';
  state.positionTriangle = document.createElementNS(SVG_NS, 'polygon');
  state.positionTriangle.setAttribute('fill', '#333');
  state.positionTriangle.style.display = 'none';
  state.positionGroup.appendChild(state.positionTriangle);

  updateChartPositionIndicator(state, currentAnimTime);
}

function isDefaultSource(src) {
  return src === 'default' || src === 'rampUp' || src === 'rampDown';
}

function drawSummaryCurves(group, leftPoints, rightPoints, maxTime, plotWidth, plotHeight) {
  const segCount = leftPoints.length - 1;
  if (segCount <= 0) return;

  const briMatch = (i) => Math.abs(leftPoints[i].b - rightPoints[i].b) < 0.01;

  // Classify segments
  const segClass = [];
  for (let i = 0; i < segCount; i++) {
    const isDef = isDefaultSource(leftPoints[i].src) || isDefaultSource(rightPoints[i].src);
    const isMatch = briMatch(i) && briMatch(i + 1);
    segClass.push({ isDef, isMatch });
  }

  // Group consecutive segments with same classification into polyline runs
  const drawRun = (pts, startSeg, endSeg, color, isDef) => {
    if (startSeg > endSeg) return;
    const runPoints = [];
    for (let i = startSeg; i <= endSeg + 1 && i < pts.length; i++) {
      runPoints.push(pts[i]);
    }
    if (runPoints.length < 2) return;

    const svgPoints = runPoints.map(p =>
      `${timeToX(p.t, maxTime, plotWidth)},${brightnessToY(p.b, plotHeight)}`
    ).join(' ');

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', svgPoints);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linejoin', 'round');
    if (isDef) polyline.setAttribute('stroke-dasharray', '6,4');
    polyline.classList.add('chart-curve');
    group.appendChild(polyline);
  };

  let runStart = 0;
  while (runStart < segCount) {
    const { isDef, isMatch } = segClass[runStart];
    let runEnd = runStart;
    while (runEnd + 1 < segCount &&
           segClass[runEnd + 1].isDef === isDef &&
           segClass[runEnd + 1].isMatch === isMatch) {
      runEnd++;
    }

    if (isMatch) {
      drawRun(leftPoints, runStart, runEnd, '#00b400', isDef);
    } else {
      drawRun(leftPoints, runStart, runEnd, '#0000ff', isDef);
      drawRun(rightPoints, runStart, runEnd, '#ff0000', isDef);
    }

    runStart = runEnd + 1;
  }
}

function drawSVGPerLightBoundaries(group, plotWidth, plotHeight, maxTime, physicalChId, config) {
  if (!currentPhaseTimeline) return;

  const timeline = currentPhaseTimeline;
  const controllingChannels = getControllingChannelsSorted(physicalChId, config, timeline);

  const boundaries = [];
  for (const chId of controllingChannels) {
    const phaseIdx = timeline.channelPhaseMap[chId];
    if (phaseIdx === undefined) continue;

    const phase = timeline.phases[phaseIdx];
    const leftSeq = findSequenceByChannelId('left', chId);
    const rightSeq = findSequenceByChannelId('right', chId);
    const leftDur = leftSeq ? getSequenceDuration(leftSeq) : 0;
    const rightDur = rightSeq ? getSequenceDuration(rightSeq) : 0;
    const seqDur = Math.max(leftDur, rightDur);

    const contentEnd = phase.maxDuration !== null
      ? Math.min(phase.start + seqDur, phase.start + phase.maxDuration)
      : phase.start + seqDur;

    const shortLabel = `Ch${chId}`;
    boundaries.push({ start: phase.start, contentEnd, chId, shortLabel });
  }

  if (boundaries.length === 0) return;

  const boundaryColor = '#b46464';

  // Boundary lines
  const linePoints = new Set();
  for (const b of boundaries) {
    if (b.start > 0) linePoints.add(b.start);
    if (b.contentEnd > 0 && b.contentEnd < maxTime) linePoints.add(b.contentEnd);
  }

  for (const t of linePoints) {
    const x = timeToX(t, maxTime, plotWidth);
    const line = appendSVGLine(group, x, TL_MARGIN, x, TL_MARGIN + plotHeight, boundaryColor, 1);
    line.setAttribute('stroke-dasharray', '5,5');
  }

  // Region labels
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    if (b.contentEnd > b.start) {
      const midX = timeToX((b.start + b.contentEnd) / 2, maxTime, plotWidth);
      appendSVGText(group, midX, TL_MARGIN - 4, b.shortLabel, 'middle', '9px', boundaryColor);
    }

    if (i + 1 < boundaries.length) {
      const gapStart = b.contentEnd;
      const gapEnd = boundaries[i + 1].start;
      if (gapEnd > gapStart) {
        const midX = timeToX((gapStart + gapEnd) / 2, maxTime, plotWidth);
        appendSVGText(group, midX, TL_MARGIN - 4, 'Default', 'middle', '9px', boundaryColor);
      }
    }
  }

  // Time labels below chart
  for (const t of linePoints) {
    const x = timeToX(t, maxTime, plotWidth);
    const label = t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`;
    appendSVGText(group, x, TL_MARGIN + plotHeight + 24, label, 'middle', '8px', boundaryColor);
  }
}

function drawSummaryLegend(group, plotWidth, plotHeight) {
  const lx = TL_MARGIN + plotWidth - 105;
  const ly = TL_MARGIN + plotHeight - 22;

  // Background
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', lx - 4);
  bg.setAttribute('y', ly - 2);
  bg.setAttribute('width', 110);
  bg.setAttribute('height', 18);
  bg.setAttribute('rx', 3);
  bg.setAttribute('fill', 'rgba(255,255,255,0.85)');
  bg.setAttribute('stroke', 'none');
  group.appendChild(bg);

  // Solid line + "Channel" label
  appendSVGLine(group, lx, ly + 7, lx + 16, ly + 7, '#00b400', 2);
  appendSVGText(group, lx + 19, ly + 10, 'Channel', 'start', '8px', '#555');

  // Dashed line + "Default" label
  const dashLine = appendSVGLine(group, lx + 58, ly + 7, lx + 74, ly + 7, '#00b400', 2);
  dashLine.setAttribute('stroke-dasharray', '6,4');
  appendSVGText(group, lx + 77, ly + 10, 'Default', 'start', '8px', '#555');
}

// ============================================================================
// Edit Mode Toggle
// ============================================================================

function toggleChartEditMode(seqIndex) {
  const chart = chartInstances[seqIndex];
  if (!chart) return;

  const wasEditing = !!chart.editMode;

  if (wasEditing) {
    // Turn off edit mode
    chart.editMode = false;
  } else {
    // Turn on — default to 'both'
    chart.editMode = 'both';
  }

  // Update toggle button
  const controls = chart.wrapper.querySelector('.chart-edit-controls');
  const btn = controls.querySelector('.chart-edit-toggle');
  const sideSelector = controls.querySelector('.chart-side-selector');
  btn.classList.toggle('active', !!chart.editMode);
  sideSelector.style.display = chart.editMode ? '' : 'none';

  if (chart.editMode) {
    chart.handlesGroup.style.display = '';
    const svgWidth = chart.svg.getBoundingClientRect().width;
    if (svgWidth > 0) renderSequenceChartContent(chart, svgWidth);
    wireChartEditInteractions(chart);
  } else {
    chart.handlesGroup.style.display = 'none';
    chart.handlesGroup.innerHTML = '';
    if (chart._editCleanup) chart._editCleanup();
    const inspector = chart.wrapper.querySelector('.chart-inspector');
    if (inspector) inspector.remove();
  }
}

function wireChartEditInteractions(chart) {
  const svg = chart.svg;
  const { seqIndex } = chart;

  if (chart._editCleanup) chart._editCleanup();

  let chartDragState = null;

  // Inspector panel
  let inspector = chart.wrapper.querySelector('.chart-inspector');
  if (!inspector) {
    inspector = document.createElement('div');
    inspector.className = 'tl-inspector chart-inspector';
    inspector.style.display = 'none';
    chart.wrapper.appendChild(inspector);
  }

  // Helper: get the sides to check based on edit mode
  const getEditableSides = () => {
    if (chart.editMode === 'left') return ['left'];
    if (chart.editMode === 'right') return ['right'];
    return ['left', 'right'];
  };

  // Helper: apply edit to one sequence side
  const commitSideEdit = (side, seq, pointIndex, rawTime, rawBri) => {
    const rawPoints = parseForChart(seq).points;
    const stepIndex = pointIndex - 1;

    seq.data[stepIndex * 2 + 1] = Math.round(rawBri).toString(16).toUpperCase().padStart(2, '0');

    const prevTime = rawPoints[pointIndex - 1].t;
    const newDuration = Math.max(0, Math.round((rawTime - prevTime) / 20));
    seq.data[stepIndex * 2] = newDuration.toString(16).toUpperCase().padStart(2, '0');

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < Math.floor(seq.data.length / 2) && pointIndex + 1 < rawPoints.length) {
      const nextPointTime = rawPoints[pointIndex + 1].t;
      const nextDuration = Math.max(0, Math.round((nextPointTime - rawTime) / 20));
      seq.data[nextStepIndex * 2] = nextDuration.toString(16).toUpperCase().padStart(2, '0');
    }

    seq.lengthVal = Math.floor(seq.data.length / 2);
  };

  const onMouseDown = (e) => {
    if (!chart.editMode) return;

    const handle = e.target.closest('.tl-handle');
    if (handle) {
      e.preventDefault();
      e.stopPropagation();
      const pointIndex = parseInt(handle.dataset.pointIndex);
      const handleSide = handle.dataset.side; // 'left', 'right', or 'both'

      // For combined handles, use left seq for inspector but track both
      const primarySide = handleSide === 'both' ? 'left' : handleSide;
      const seq = sideData[primarySide].sequences[seqIndex];
      const points = parseForChart(seq).points;

      const phaseOffset = getChannelPhaseOffset(seqIndex);
      if (phaseOffset > 0) {
        for (const p of points) p.t += phaseOffset;
      }
      applyDefaultBrightnessToPoints(points, seqIndex);

      tlSelectedKeypoint = { side: primarySide, seqIndex, pointIndex };
      updateSelectionVisual(chart.handlesGroup);
      updateInspector(inspector, primarySide, seqIndex, seq, points, pointIndex);

      chartDragState = {
        handleSide,
        seqIndex,
        pointIndex,
        seq,
        points,
        phaseOffset
      };
      svg.classList.add('tl-dragging');
      return;
    }

    // Check for insert on editable curves
    const svgRect = svg.getBoundingClientRect();
    const localX = e.clientX - svgRect.left;
    const localY = e.clientY - svgRect.top;

    if (localX >= TL_MARGIN && localX <= TL_MARGIN + chart.plotWidth &&
        localY >= TL_MARGIN && localY <= TL_MARGIN + chart.plotHeight) {

      const clickTime = xToTime(localX, chart.maxTime, chart.plotWidth);
      const clickBri = yToBrightness(localY, chart.plotHeight);

      let bestResult = null;
      let bestDist = Infinity;
      let bestSide = null;

      for (const side of getEditableSides()) {
        const seq = sideData[side].sequences[seqIndex];
        if (!seq || seq.identifier === RAW_IDENTIFIER) continue;
        const pts = parseForChart(seq).points;
        const phaseOffset = getChannelPhaseOffset(seqIndex);
        if (phaseOffset > 0) {
          for (const p of pts) p.t += phaseOffset;
        }
        applyDefaultBrightnessToPoints(pts, seqIndex);

        const result = findInsertSegment(pts, clickTime, chart.maxTime, chart.plotWidth, chart.plotHeight, localX, localY);
        if (result) {
          const i = result.segmentIndex;
          const x1 = timeToX(pts[i].t, chart.maxTime, chart.plotWidth);
          const y1 = brightnessToY(pts[i].b, chart.plotHeight);
          const x2 = timeToX(pts[i + 1].t, chart.maxTime, chart.plotWidth);
          const y2 = brightnessToY(pts[i + 1].b, chart.plotHeight);
          const dist = pointToSegmentDistance(localX, localY, x1, y1, x2, y2);
          if (dist < bestDist) {
            bestDist = dist;
            bestResult = result;
            bestSide = side;
          }
        }
      }

      if (bestResult && bestSide) {
        const seq = sideData[bestSide].sequences[seqIndex];
        const phaseOffset = getChannelPhaseOffset(seqIndex);
        insertTimelinePoint(bestSide, seqIndex, seq, bestResult.segmentIndex, clickTime - phaseOffset, clickBri);
        return;
      }
    }

    // Deselect
    tlSelectedKeypoint = null;
    updateSelectionVisual(chart.handlesGroup);
    inspector.style.display = 'none';
  };

  const onMouseMove = (e) => {
    if (!chartDragState) return;
    e.preventDefault();

    const svgRect = svg.getBoundingClientRect();
    const localX = e.clientX - svgRect.left;
    const localY = e.clientY - svgRect.top;

    const { pointIndex, seq, phaseOffset, handleSide } = chartDragState;
    const maxTime = chart.maxTime;

    let rawTime = xToTime(localX, maxTime, chart.plotWidth);
    let rawBri = yToBrightness(localY, chart.plotHeight);

    rawTime -= phaseOffset;
    rawTime = Math.round(rawTime / 20) * 20;
    rawBri = Math.round(Math.max(0, Math.min(100, rawBri)));

    // Clamp within neighbor bounds (use primary side for constraints)
    const rawPoints = parseForChart(seq).points;
    const minTime = (pointIndex > 1) ? rawPoints[pointIndex - 1].t + 20 : 20;
    const maxPointTime = (pointIndex < rawPoints.length - 1) ? rawPoints[pointIndex + 1].t - 20 : maxTime;
    rawTime = Math.max(minTime, Math.min(maxPointTime, rawTime));

    // Live update handle position
    const handle = svg.querySelector(`.tl-handles circle[data-point-index="${pointIndex}"][data-side="${handleSide}"]`);
    if (handle) {
      handle.setAttribute('cx', timeToX(rawTime + phaseOffset, maxTime, chart.plotWidth));
      handle.setAttribute('cy', brightnessToY(rawBri, chart.plotHeight));
    }

    chartDragState.rawTime = rawTime;
    chartDragState.rawBri = rawBri;

    updateInspectorLive(inspector, rawPoints, pointIndex, rawTime + phaseOffset, rawBri);
  };

  const onMouseUp = () => {
    if (!chartDragState) return;

    const { pointIndex, handleSide } = chartDragState;
    const rawTime = chartDragState.rawTime;
    const rawBri = chartDragState.rawBri;

    if (rawTime !== undefined && rawBri !== undefined) {
      // Determine which sides to modify
      const sidesToEdit = handleSide === 'both' ? ['left', 'right'] : [handleSide];

      for (const side of sidesToEdit) {
        const seq = sideData[side].sequences[seqIndex];
        if (!seq || seq.identifier === RAW_IDENTIFIER) continue;
        commitSideEdit(side, seq, pointIndex, rawTime, rawBri);
      }

      // Apply and re-render for each affected side
      for (const side of sidesToEdit) {
        applySequenceEdit(side, seqIndex);
        renderSequenceEditor(side, seqIndex);
      }
    }

    svg.classList.remove('tl-dragging');
    chartDragState = null;
  };

  const onKeyDown = (e) => {
    if (!chart.editMode || !tlSelectedKeypoint || tlSelectedKeypoint.seqIndex !== seqIndex) return;
    const { side, pointIndex } = tlSelectedKeypoint;
    if (pointIndex === 0) return;

    const seq = sideData[side].sequences[seqIndex];
    if (!seq) return;

    handleTimelineKeydown(e, side, seqIndex, seq, inspector);
  };

  svg.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  svg.addEventListener('keydown', onKeyDown);
  svg.setAttribute('tabindex', '0');

  chart._editCleanup = () => {
    svg.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    svg.removeEventListener('keydown', onKeyDown);
    chart._editCleanup = null;
  };
}

function applyDefaultBrightnessToPoints(points, seqIndex) {
  if (!currentPhaseTimeline || points.length === 0) return;

  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const seq = leftSeq || rightSeq;
  if (!seq || seq.identifier === RAW_IDENTIFIER) return;

  const chId = parseInt(seq.identifier, 16);
  const vehicleKey = document.getElementById("vehicleSelect").value;
  const config = VEHICLE_CONFIGS[vehicleKey];
  if (!config) return;

  const chConfig = config.channels && config.channels.find(c => c.id === chId);
  if (chConfig && chConfig.physicalLight && config.defaultStates) {
    const defaultBri = (config.defaultStates[chConfig.physicalLight] || {}).brightness || 0;
    if (points.length > 0) points[0].b = defaultBri;
  }
}

function cleanupSummaryCharts() {
  summaryChartInstances = [];
}
