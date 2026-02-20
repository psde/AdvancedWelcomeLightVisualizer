let tlDragState = null;
let tlSelectedKeypoint = null;

function getTimelineMaxTime(seq, side, seqIndex) {
  const chartData = parseForChart(seq);
  const otherSide = side === 'left' ? 'right' : 'left';
  const otherSeq = sideData[otherSide].sequences[seqIndex];
  const otherData = otherSeq ? parseForChart(otherSeq) : { maxT: 0 };
  const localMax = Math.max(chartData.maxT, otherData.maxT);
  // Add 10% padding so points at the edge aren't clipped
  return Math.max(localMax * 1.1, 500);
}

// Grid step calculation matching chart.js pattern
function getGridStepX(maxTime) {
  if (maxTime <= 2500) return { grid: 50, label: 500 };
  if (maxTime <= 10000) return { grid: 200, label: 1000 };
  return { grid: 500, label: 5000 };
}

function renderTimelineEditor(container, side, seqIndex, seq) {
  container.innerHTML = '';

  if (!seq || seq.identifier === RAW_IDENTIFIER) {
    const msg = document.createElement('p');
    msg.className = 'raw-data-msg';
    msg.textContent = 'RAW data \u2014 use hex mode to edit';
    container.appendChild(msg);
    return;
  }

  const points = parseForChart(seq).points;
  applyDefaultBrightnessToPoints(points, seqIndex);
  const maxTime = getTimelineMaxTime(seq, side, seqIndex);

  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-wrapper';

  // SVG element
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'timeline-editor');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', TL_HEIGHT);
  svg.setAttribute('tabindex', '0');

  // Groups in render order (bottom to top)
  const gridGroup = createSVGGroup(svg, 'tl-grid');
  const fillGroup = createSVGGroup(svg, 'tl-fill');
  const curveGroup = createSVGGroup(svg, 'tl-curve');
  const handlesGroup = createSVGGroup(svg, 'tl-handles');

  // We need actual pixel width — use a ResizeObserver after mount
  const renderState = { svg, gridGroup, fillGroup, curveGroup, handlesGroup, points, maxTime, side, seqIndex, seq, lastRenderedWidth: 0 };

  wrapper.appendChild(svg);

  // Inspector panel
  const inspector = document.createElement('div');
  inspector.className = 'tl-inspector';
  inspector.style.display = 'none';
  wrapper.appendChild(inspector);

  container.appendChild(wrapper);

  // Initial render once SVG has layout dimensions
  requestAnimationFrame(() => {
    const currentSvg = renderState.svg;
    const svgWidth = currentSvg.getBoundingClientRect().width;
    if (svgWidth > 0) {
      renderSVGContent(renderState, svgWidth, inspector);
      // Restore selection state after re-render
      restoreTimelineSelection(renderState, inspector);
    }
  });

  // Handle resize — observe wrapper since SVG gets cloned during interaction wiring
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const newWidth = Math.round(entry.contentRect.width);
      if (newWidth > 0 && newWidth !== renderState.lastRenderedWidth) {
        renderSVGContent(renderState, newWidth, inspector);
        restoreTimelineSelection(renderState, inspector);
      }
    }
  });
  resizeObserver.observe(wrapper);

  // Clean up observer when container is emptied
  const mutObserver = new MutationObserver(() => {
    if (!container.contains(wrapper)) {
      resizeObserver.disconnect();
      mutObserver.disconnect();
    }
  });
  mutObserver.observe(container, { childList: true });
}

function renderSVGContent(state, svgWidth, inspector) {
  const { svg, gridGroup, fillGroup, curveGroup, handlesGroup, points, maxTime, side, seqIndex, seq } = state;
  state.lastRenderedWidth = Math.round(svgWidth);
  const plotWidth = svgWidth - 2 * TL_MARGIN;
  const plotHeight = TL_HEIGHT - 2 * TL_MARGIN;
  const color = getSideColor(side);

  // Clear all groups
  gridGroup.innerHTML = '';
  fillGroup.innerHTML = '';
  curveGroup.innerHTML = '';
  handlesGroup.innerHTML = '';

  // Draw grid
  drawTimelineGrid(gridGroup, plotWidth, plotHeight, maxTime);

  // Draw fill polygon
  drawTimelineFill(fillGroup, points, maxTime, plotWidth, plotHeight, color);

  // Draw curve polyline
  drawTimelineCurve(curveGroup, points, maxTime, plotWidth, plotHeight, color);

  // Draw handles
  drawTimelineHandles(handlesGroup, points, maxTime, plotWidth, plotHeight, color, side, seqIndex);

  // Update selection visual
  updateSelectionVisual(handlesGroup);

  // Wire up interactions
  wireTimelineInteractions(svg, state, svgWidth, plotWidth, plotHeight, inspector);
}

function drawTimelineGrid(group, plotWidth, plotHeight, maxTime) {
  // Plot area border
  appendSVGLine(group, TL_MARGIN, TL_MARGIN, TL_MARGIN + plotWidth, TL_MARGIN, '#000', 1);
  appendSVGLine(group, TL_MARGIN, TL_MARGIN + plotHeight, TL_MARGIN + plotWidth, TL_MARGIN + plotHeight, '#000', 1);
  appendSVGLine(group, TL_MARGIN, TL_MARGIN, TL_MARGIN, TL_MARGIN + plotHeight, '#000', 1);
  appendSVGLine(group, TL_MARGIN + plotWidth, TL_MARGIN, TL_MARGIN + plotWidth, TL_MARGIN + plotHeight, '#000', 1);

  const { grid: gridStep, label: labelStep } = getGridStepX(maxTime);

  // X-axis grid lines and labels
  for (let t = 0; t <= maxTime; t += gridStep) {
    const x = timeToX(t, maxTime, plotWidth);
    if (x > TL_MARGIN + plotWidth + 0.5) break;
    appendSVGLine(group, x, TL_MARGIN, x, TL_MARGIN + plotHeight, '#ddd', 1);
    if (t % labelStep === 0) {
      appendSVGText(group, x, TL_MARGIN + plotHeight + 14, `${t}`, 'middle', '10px', '#333');
    }
  }

  // Y-axis grid lines and labels
  for (let b = 0; b <= 100; b += 10) {
    const y = brightnessToY(b, plotHeight);
    appendSVGLine(group, TL_MARGIN, y, TL_MARGIN + plotWidth, y, '#ddd', 1);
    appendSVGText(group, TL_MARGIN - 5, y + 3, `${b}`, 'end', '10px', '#333');
  }

  // Axis labels
  appendSVGText(group, TL_MARGIN + plotWidth / 2, TL_MARGIN + plotHeight + 30, 'Time (ms)', 'middle', '11px', '#333');
  const yLabel = document.createElementNS(SVG_NS, 'text');
  yLabel.setAttribute('x', TL_MARGIN - 30);
  yLabel.setAttribute('y', TL_MARGIN + plotHeight / 2);
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.setAttribute('font-size', '11px');
  yLabel.setAttribute('fill', '#333');
  yLabel.setAttribute('transform', `rotate(-90, ${TL_MARGIN - 30}, ${TL_MARGIN + plotHeight / 2})`);
  yLabel.textContent = 'Brightness (%)';
  group.appendChild(yLabel);
}

function drawTimelineFill(group, points, maxTime, plotWidth, plotHeight, color) {
  drawFillPolygon(group, points, maxTime, plotWidth, plotHeight, color, '0.1');
}

function drawTimelineCurve(group, points, maxTime, plotWidth, plotHeight, color) {
  drawCurvePolyline(group, points, maxTime, plotWidth, plotHeight, color, 2);
}

function drawTimelineHandles(group, points, maxTime, plotWidth, plotHeight, color, side, seqIndex) {
  for (let i = 0; i < points.length; i++) {
    drawHandle(group, points[i], i, side, seqIndex, maxTime, plotWidth, plotHeight, color);
  }
}

function updateSelectionVisual(handlesGroup) {
  const circles = handlesGroup.querySelectorAll('circle');
  circles.forEach(c => c.classList.remove('selected'));

  if (!tlSelectedKeypoint) return;

  const { side, seqIndex, pointIndex } = tlSelectedKeypoint;
  const match = handlesGroup.querySelector(
    `circle[data-point-index="${pointIndex}"][data-side="${side}"][data-seq-index="${seqIndex}"]`
  );
  if (match) match.classList.add('selected');
}

function restoreTimelineSelection(state, inspector) {
  if (!tlSelectedKeypoint) return;
  const { side, seqIndex, pointIndex } = tlSelectedKeypoint;
  if (side !== state.side || seqIndex !== state.seqIndex) return;
  if (pointIndex <= 0 || pointIndex >= state.points.length) {
    tlSelectedKeypoint = null;
    return;
  }
  updateSelectionVisual(state.handlesGroup);
  updateInspector(inspector, side, seqIndex, state.seq, state.points, pointIndex);
  // Focus the SVG so keyboard events work immediately
  state.svg.focus();
}

function wireTimelineInteractions(svg, state, svgWidth, plotWidth, plotHeight, inspector) {
  const { points, maxTime, side, seqIndex, seq } = state;

  // Abort previous SVG-level listeners
  if (state._interactionAbort) state._interactionAbort.abort();
  const controller = new AbortController();
  state._interactionAbort = controller;

  // Mouse/pointer events for drag
  svg.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.tl-handle');
    if (handle) {
      e.preventDefault();
      const pointIndex = parseInt(handle.dataset.pointIndex, 10);
      tlSelectedKeypoint = { side, seqIndex, pointIndex };
      updateSelectionVisual(state.handlesGroup);
      updateInspector(inspector, side, seqIndex, seq, points, pointIndex);

      tlDragState = {
        side,
        seqIndex,
        pointIndex,
        svg,
        state,
        plotWidth,
        plotHeight,
        svgWidth,
        inspector
      };
      svg.classList.add('tl-dragging');
      return;
    }

    // Click on empty area — check for insert or deselect
    const svgRect = svg.getBoundingClientRect();
    const localX = e.clientX - svgRect.left;
    const localY = e.clientY - svgRect.top;

    if (localX >= TL_MARGIN && localX <= TL_MARGIN + plotWidth &&
        localY >= TL_MARGIN && localY <= TL_MARGIN + plotHeight) {
      // Check if click is near the curve (within ~10px) for insert
      const clickTime = xToTime(localX, maxTime, plotWidth);
      const clickBri = yToBrightness(localY, plotHeight);

      const insertResult = findInsertSegment(points, clickTime, maxTime, plotWidth, plotHeight, localX, localY);
      if (insertResult) {
        insertTimelinePoint(side, seqIndex, seq, insertResult.segmentIndex, clickTime, clickBri);
        return;
      }
    }

    // Deselect
    tlSelectedKeypoint = null;
    updateSelectionVisual(state.handlesGroup);
    inspector.style.display = 'none';
  }, { signal: controller.signal });

  // Remove previous global listeners if they exist from a prior wiring
  if (state._dragCleanup) state._dragCleanup();

  // Global move/up handlers for drag
  const onMouseMove = (e) => {
    if (!tlDragState || tlDragState.svg !== svg) return;
    e.preventDefault();
    handleTimelineDrag(e);
  };

  const onMouseUp = (e) => {
    if (!tlDragState || tlDragState.svg !== svg) return;
    e.preventDefault();
    commitTimelineDrag();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  state._dragCleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    state._dragCleanup = null;
  };

  // Keyboard handling
  svg.addEventListener('keydown', (e) => {
    if (!tlSelectedKeypoint || tlSelectedKeypoint.side !== side || tlSelectedKeypoint.seqIndex !== seqIndex) return;
    handleTimelineKeydown(e, side, seqIndex, seq, inspector);
  }, { signal: controller.signal });
}

function findInsertSegment(points, clickTime, maxTime, plotWidth, plotHeight, localX, localY) {
  const hitThreshold = 12;

  for (let i = 0; i < points.length - 1; i++) {
    if (clickTime >= points[i].t && clickTime <= points[i + 1].t) {
      // Check distance from click to line segment
      const x1 = timeToX(points[i].t, maxTime, plotWidth);
      const y1 = brightnessToY(points[i].b, plotHeight);
      const x2 = timeToX(points[i + 1].t, maxTime, plotWidth);
      const y2 = brightnessToY(points[i + 1].b, plotHeight);

      const dist = pointToSegmentDistance(localX, localY, x1, y1, x2, y2);
      if (dist <= hitThreshold) {
        return { segmentIndex: i };
      }
    }
  }
  return null;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  return Math.hypot(px - nearX, py - nearY);
}

function insertTimelinePoint(side, seqIndex, seq, segmentIndex, clickTime, clickBri) {
  // Snap to 20ms grid and 1% brightness
  const snappedTime = Math.round(clickTime / TIME_MULTIPLIER) * TIME_MULTIPLIER;
  const snappedBri = Math.round(Math.max(0, Math.min(100, clickBri)));

  // segmentIndex i: insert between point i and point i+1
  // Point i+1 corresponds to step i in seq.data (step = pointIndex - 1)
  // New point splits the segment: new step gets duration from point i to new point,
  // existing step i gets remaining duration to point i+1

  const points = parseForChart(seq).points;
  const prevTime = points[segmentIndex].t;
  const nextTime = points[segmentIndex + 1].t;

  // Clamp new time between neighbors
  const clampedTime = Math.max(prevTime + TIME_MULTIPLIER, Math.min(nextTime - TIME_MULTIPLIER, snappedTime));

  const newDuration = Math.min(255, Math.round((clampedTime - prevTime) / TIME_MULTIPLIER));
  const remainingDuration = Math.min(255, Math.round((nextTime - clampedTime) / TIME_MULTIPLIER));

  const newDurHex = newDuration.toString(16).toUpperCase().padStart(2, '0');
  const newBriHex = snappedBri.toString(16).toUpperCase().padStart(2, '0');
  const remainDurHex = remainingDuration.toString(16).toUpperCase().padStart(2, '0');

  // Insert position in seq.data: step index = segmentIndex (insert before existing step at segmentIndex)
  const insertPos = segmentIndex * 2;
  seq.data.splice(insertPos, 0, newDurHex, newBriHex);
  // Update the next step's duration (which shifted by 2)
  seq.data[insertPos + 2] = remainDurHex;
  seq.lengthVal = Math.floor(seq.data.length / 2);

  // Select the newly inserted point
  tlSelectedKeypoint = { side, seqIndex, pointIndex: segmentIndex + 1 };

  applySequenceEdit(side, seqIndex);
  renderSequenceEditor(side, seqIndex);
}

function handleTimelineDrag(e) {
  if (!tlDragState) return;

  const { pointIndex, svg, state, plotWidth, plotHeight } = tlDragState;
  const { points, maxTime } = state;

  const svgRect = svg.getBoundingClientRect();
  const localX = e.clientX - svgRect.left;
  const localY = e.clientY - svgRect.top;

  // Compute raw time and brightness
  let rawTime = xToTime(localX, maxTime, plotWidth);
  let rawBri = yToBrightness(localY, plotHeight);

  // Snap to 20ms grid
  rawTime = Math.round(rawTime / TIME_MULTIPLIER) * TIME_MULTIPLIER;
  // Clamp brightness
  rawBri = Math.round(Math.max(0, Math.min(100, rawBri)));

  // Clamp time: must stay between neighbors with at least 20ms gap
  const minTime = (pointIndex > 1) ? points[pointIndex - 1].t + TIME_MULTIPLIER : TIME_MULTIPLIER;
  const maxPointTime = (pointIndex < points.length - 1) ? points[pointIndex + 1].t - TIME_MULTIPLIER : maxTime;
  rawTime = Math.max(minTime, Math.min(maxPointTime, rawTime));

  // Live update SVG positions without full re-render
  const handle = svg.querySelector(`.tl-handles circle[data-point-index="${pointIndex}"]`);
  if (handle) {
    const newCx = timeToX(rawTime, maxTime, plotWidth);
    const newCy = brightnessToY(rawBri, plotHeight);
    handle.setAttribute('cx', newCx);
    handle.setAttribute('cy', newCy);
  }

  // Update polyline and fill polygon live
  points[pointIndex] = { t: rawTime, b: rawBri };
  updateCurveAndFill(state, plotWidth, plotHeight);

  // Live-update inspector values
  updateInspectorLive(tlDragState.inspector, points, pointIndex, rawTime, rawBri);
}

function updateInspectorLive(inspector, points, pointIndex, time, brightness) {
  if (!inspector || inspector.style.display === 'none') return;

  const inputs = inspector.querySelectorAll('.tl-inspector-input');
  if (inputs.length < 2) return;

  const prevTime = points[pointIndex - 1] ? points[pointIndex - 1].t : 0;
  const duration = time - prevTime;

  inputs[0].value = Math.round(duration);
  inputs[1].value = Math.round(brightness);

  // Update start time display
  const startSpan = inspector.querySelector('.tl-inspector-field');
  if (startSpan && startSpan.textContent.startsWith('Start:')) {
    startSpan.textContent = `Start: ${formatStepTime(prevTime)}`;
  }
}

function updateCurveAndFill(state, plotWidth, plotHeight) {
  const { fillGroup, curveGroup, points, maxTime, side } = state;
  const color = getSideColor(side);

  // Update polyline
  const polyline = curveGroup.querySelector('polyline');
  if (polyline) {
    const linePoints = points.map(p =>
      `${timeToX(p.t, maxTime, plotWidth)},${brightnessToY(p.b, plotHeight)}`
    ).join(' ');
    polyline.setAttribute('points', linePoints);
  }

  // Update fill polygon
  const polygon = fillGroup.querySelector('polygon');
  if (polygon) {
    const polyPoints = [];
    for (const p of points) {
      polyPoints.push(`${timeToX(p.t, maxTime, plotWidth)},${brightnessToY(p.b, plotHeight)}`);
    }
    polyPoints.push(`${timeToX(points[points.length - 1].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);
    polyPoints.push(`${timeToX(points[0].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);
    polygon.setAttribute('points', polyPoints.join(' '));
  }
}

function commitTimelineDrag() {
  if (!tlDragState) return;

  const { pointIndex, state, inspector } = tlDragState;
  const { points, side, seqIndex, seq } = state;
  const draggedPoint = points[pointIndex];

  // Write back to seq.data
  // Point K corresponds to step K-1 in seq.data
  const stepIndex = pointIndex - 1;

  // Update brightness for this step
  const briHex = Math.round(draggedPoint.b).toString(16).toUpperCase().padStart(2, '0');
  seq.data[stepIndex * 2 + 1] = briHex;

  // Update duration for this step: delta from previous point
  const prevTime = points[pointIndex - 1].t;
  const newDuration = Math.max(0, Math.min(255, Math.round((draggedPoint.t - prevTime) / TIME_MULTIPLIER)));
  const durHex = newDuration.toString(16).toUpperCase().padStart(2, '0');
  seq.data[stepIndex * 2] = durHex;

  // Keep subsequent points stationary: adjust next step's duration to compensate
  const nextStepIndex = stepIndex + 1;
  if (nextStepIndex < Math.floor(seq.data.length / 2) && pointIndex + 1 < points.length) {
    const nextPointTime = points[pointIndex + 1].t;
    const nextDuration = Math.max(0, Math.min(255, Math.round((nextPointTime - draggedPoint.t) / TIME_MULTIPLIER)));
    const nextDurHex = nextDuration.toString(16).toUpperCase().padStart(2, '0');
    seq.data[nextStepIndex * 2] = nextDurHex;
  }

  tlDragState.svg.classList.remove('tl-dragging');
  tlDragState = null;

  seq.lengthVal = Math.floor(seq.data.length / 2);
  applySequenceEdit(side, seqIndex);
  renderSequenceEditor(side, seqIndex);
}

function handleTimelineKeydown(e, side, seqIndex, seq, inspector) {
  const { pointIndex } = tlSelectedKeypoint;
  if (pointIndex === 0) return; // Can't edit origin

  const points = parseForChart(seq).points;
  if (pointIndex >= points.length) return;

  const shiftHeld = e.shiftKey;
  let timeDelta = 0;
  let briDelta = 0;

  switch (e.key) {
    case 'ArrowLeft':
      timeDelta = shiftHeld ? -100 : -20;
      break;
    case 'ArrowRight':
      timeDelta = shiftHeld ? 100 : 20;
      break;
    case 'ArrowUp':
      briDelta = shiftHeld ? 10 : 1;
      break;
    case 'ArrowDown':
      briDelta = shiftHeld ? -10 : -1;
      break;
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      deleteTimelinePoint(side, seqIndex, seq, pointIndex, inspector);
      return;
    default:
      return;
  }

  e.preventDefault();

  const stepIndex = pointIndex - 1;
  const currentDurHex = parseInt(seq.data[stepIndex * 2], 16) || 0;
  const currentBri = parseInt(seq.data[stepIndex * 2 + 1], 16) || 0;

  if (timeDelta !== 0) {
    // Duration change: adjust this step's duration in 20ms units
    const durUnits = Math.round(timeDelta / TIME_MULTIPLIER);
    const newDur = Math.max(0, Math.min(255, currentDurHex + durUnits));
    seq.data[stepIndex * 2] = newDur.toString(16).toUpperCase().padStart(2, '0');
  }

  if (briDelta !== 0) {
    const newBri = Math.max(0, Math.min(100, currentBri + briDelta));
    seq.data[stepIndex * 2 + 1] = newBri.toString(16).toUpperCase().padStart(2, '0');
  }

  seq.lengthVal = Math.floor(seq.data.length / 2);
  applySequenceEdit(side, seqIndex);
  renderSequenceEditor(side, seqIndex);
}

function deleteTimelinePoint(side, seqIndex, seq, pointIndex, inspector) {
  if (pointIndex <= 0 || pointIndex >= parseForChart(seq).points.length) return;
  const stepCount = Math.floor(seq.data.length / 2);
  if (stepCount <= 1) return; // Don't delete the last step

  const stepIndex = pointIndex - 1;
  const removedDur = parseInt(seq.data[stepIndex * 2], 16) || 0;

  // Remove the 2 bytes for this step
  seq.data.splice(stepIndex * 2, 2);

  // Absorb removed duration into the next step (if exists) to keep subsequent points stationary
  if (stepIndex < Math.floor(seq.data.length / 2)) {
    const nextDur = parseInt(seq.data[stepIndex * 2], 16) || 0;
    const mergedDur = Math.min(255, nextDur + removedDur);
    seq.data[stepIndex * 2] = mergedDur.toString(16).toUpperCase().padStart(2, '0');
  }

  seq.lengthVal = Math.floor(seq.data.length / 2);

  // Clear selection
  tlSelectedKeypoint = null;
  inspector.style.display = 'none';

  applySequenceEdit(side, seqIndex);
  renderSequenceEditor(side, seqIndex);
}

function updateInspector(inspector, side, seqIndex, seq, points, pointIndex) {
  if (pointIndex <= 0 || !points[pointIndex]) {
    inspector.style.display = 'none';
    return;
  }

  inspector.style.display = '';
  inspector.innerHTML = '';

  const stepIndex = pointIndex - 1;
  const durHex = parseInt(seq.data[stepIndex * 2], 16) || 0;
  const briVal = parseInt(seq.data[stepIndex * 2 + 1], 16) || 0;
  const startTime = points[pointIndex - 1] ? points[pointIndex - 1].t : 0;

  // Step label
  const label = document.createElement('span');
  label.className = 'tl-inspector-label';
  label.textContent = `Step #${pointIndex}`;
  inspector.appendChild(label);

  // Start time (read-only)
  const startSpan = document.createElement('span');
  startSpan.className = 'tl-inspector-field';
  startSpan.textContent = `Start: ${formatStepTime(startTime)}`;
  inspector.appendChild(startSpan);

  // Duration input
  const durWrapper = document.createElement('label');
  durWrapper.className = 'tl-inspector-field';
  durWrapper.textContent = 'Duration: ';
  const durInput = document.createElement('input');
  durInput.type = 'number';
  durInput.min = '0';
  durInput.max = '5100';
  durInput.step = '20';
  durInput.value = durHex * TIME_MULTIPLIER;
  durInput.className = 'tl-inspector-input';
  durInput.oninput = () => {
    const ms = Math.max(0, Math.min(5100, parseInt(durInput.value, 10) || 0));
    const hexVal = Math.round(ms / TIME_MULTIPLIER);
    seq.data[stepIndex * 2] = hexVal.toString(16).toUpperCase().padStart(2, '0');
    seq.lengthVal = Math.floor(seq.data.length / 2);
    applySequenceEdit(side, seqIndex);
    renderSequenceEditor(side, seqIndex);
  };
  durWrapper.appendChild(durInput);
  const msUnit = document.createElement('span');
  msUnit.textContent = ' ms';
  durWrapper.appendChild(msUnit);
  inspector.appendChild(durWrapper);

  // Brightness input
  const briWrapper = document.createElement('label');
  briWrapper.className = 'tl-inspector-field';
  briWrapper.textContent = 'Brightness: ';
  const briInput = document.createElement('input');
  briInput.type = 'number';
  briInput.min = '0';
  briInput.max = '100';
  briInput.step = '1';
  briInput.value = briVal;
  briInput.className = 'tl-inspector-input';
  briInput.oninput = () => {
    const bri = Math.max(0, Math.min(100, parseInt(briInput.value, 10) || 0));
    seq.data[stepIndex * 2 + 1] = bri.toString(16).toUpperCase().padStart(2, '0');
    seq.lengthVal = Math.floor(seq.data.length / 2);
    applySequenceEdit(side, seqIndex);
    renderSequenceEditor(side, seqIndex);
  };
  briWrapper.appendChild(briInput);
  const pctUnit = document.createElement('span');
  pctUnit.textContent = ' %';
  briWrapper.appendChild(pctUnit);
  inspector.appendChild(briWrapper);

  // Delete button (disabled when only 1 step remains)
  const stepCount = Math.floor(seq.data.length / 2);
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tl-inspector-delete';
  deleteBtn.textContent = 'Delete Point';
  deleteBtn.title = 'Remove this point (Del)';
  deleteBtn.disabled = stepCount <= 1;
  deleteBtn.onclick = () => {
    deleteTimelinePoint(side, seqIndex, seq, pointIndex, inspector);
  };
  inspector.appendChild(deleteBtn);
}

