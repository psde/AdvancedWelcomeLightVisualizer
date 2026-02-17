let chartSketches = [];
let summaryChartSketches = [];

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

function drawChartFrame(sketch, margin, w, h, maxTime) {
  sketch.stroke(0);
  sketch.strokeWeight(1);
  sketch.noFill();
  sketch.rect(margin, margin, w, h);

  // Axis labels
  sketch.textSize(11);
  sketch.fill(0);
  sketch.noStroke();
  sketch.textAlign(sketch.CENTER);
  sketch.text("Time (ms)", margin + w / 2, margin + h + 30);
  sketch.push();
  sketch.translate(margin - 30, margin + h / 2);
  sketch.rotate(-sketch.HALF_PI);
  sketch.text("Brightness (%)", 0, 0);
  sketch.pop();

  // X-axis grid and tick labels
  const gridStep = (maxTime <= 2500) ? 50 : (maxTime <= 10000 ? 200 : 500);
  const labelStep = maxTime > 10000 ? 5000 : (maxTime > 2500 ? 1000 : 500);

  sketch.stroke(220);
  sketch.textAlign(sketch.CENTER, sketch.TOP);
  for (let t = 0; t <= maxTime; t += gridStep) {
    let x = sketch.map(t, 0, maxTime, margin, margin + w);
    if (t % labelStep === 0) {
      sketch.noStroke();
      sketch.fill(0);
      sketch.text(`${t}`, x, margin + h + 5);
      sketch.stroke(220);
      sketch.fill(255);
    }
    if (x <= margin + w) {
      sketch.line(x, margin, x, margin + h);
    }
  }
  // Y-axis grid and tick labels
  sketch.textAlign(sketch.RIGHT, sketch.CENTER);
  for (let bright = 0; bright <= 100; bright += 10) {
    let y = sketch.map(bright, 0, 100, margin + h, margin);
    sketch.noStroke();
    sketch.fill(0);
    sketch.text(`${bright}`, margin - 5, y);
    sketch.stroke(220);
    sketch.fill(255);
    sketch.line(margin, y, margin + w, y);
  }
}

function drawPhaseBoundaries(sketch, margin, w, h, maxTime) {
  if (!currentPhaseTimeline) return;

  for (const phase of currentPhaseTimeline.phases) {
    for (const boundary of [phase.start, phase.end]) {
      if (boundary <= 0 || boundary >= maxTime) continue;

      let x = sketch.map(boundary, 0, maxTime, margin, margin + w);
      sketch.stroke(180, 100, 100);
      sketch.strokeWeight(1);
      sketch.drawingContext.setLineDash([5, 5]);
      sketch.line(x, margin, x, margin + h);
      sketch.drawingContext.setLineDash([]);
    }

    let midX = sketch.map((phase.start + phase.end) / 2, 0, maxTime, margin, margin + w);
    sketch.noStroke();
    sketch.fill(180, 100, 100);
    sketch.textAlign(sketch.CENTER, sketch.BOTTOM);
    sketch.textSize(9);
    sketch.text(phase.name, midX, margin - 2);
    sketch.textSize(11);
  }
}

function drawPerLightBoundaries(sketch, margin, w, h, maxTime, physicalChId, config) {
  if (!currentPhaseTimeline) return;

  const timeline = currentPhaseTimeline;

  // Gather controlling channels sorted by phase order
  const controllingChannels = [physicalChId];
  for (const ch of config.channels) {
    if (ch.physicalLight === physicalChId) {
      controllingChannels.push(ch.id);
    }
  }

  controllingChannels.sort((a, b) => {
    const phaseA = timeline.channelPhaseMap[a] !== undefined ? timeline.channelPhaseMap[a] : -1;
    const phaseB = timeline.channelPhaseMap[b] !== undefined ? timeline.channelPhaseMap[b] : -1;
    return phaseA - phaseB;
  });

  // Compute boundaries per controlling channel
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

    const chConfig = config.channels.find(c => c.id === chId);
    const label = chConfig ? chConfig.label : `Ch${chId}`;
    const shortLabel = `Ch${chId}`;

    boundaries.push({ start: phase.start, contentEnd, chId, label, shortLabel });
  }

  if (boundaries.length === 0) return;

  const boundaryColor = [180, 100, 100];

  // Draw dashed boundary lines
  const linePoints = new Set();
  for (const b of boundaries) {
    if (b.start > 0) linePoints.add(b.start);
    if (b.contentEnd > 0 && b.contentEnd < maxTime) linePoints.add(b.contentEnd);
  }

  for (const t of linePoints) {
    const x = sketch.map(t, 0, maxTime, margin, margin + w);
    sketch.stroke(...boundaryColor);
    sketch.strokeWeight(1);
    sketch.drawingContext.setLineDash([5, 5]);
    sketch.line(x, margin, x, margin + h);
    sketch.drawingContext.setLineDash([]);
  }

  sketch.noStroke();
  sketch.fill(...boundaryColor);
  sketch.textAlign(sketch.CENTER, sketch.BOTTOM);
  sketch.textSize(9);

  // Label each region (channel or default gap)
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];

    const regionStart = b.start;
    const regionEnd = b.contentEnd;
    if (regionEnd > regionStart) {
      const midX = sketch.map((regionStart + regionEnd) / 2, 0, maxTime, margin, margin + w);
      sketch.text(b.shortLabel, midX, margin - 2);
    }

    if (i + 1 < boundaries.length) {
      const gapStart = b.contentEnd;
      const gapEnd = boundaries[i + 1].start;
      if (gapEnd > gapStart) {
        const midX = sketch.map((gapStart + gapEnd) / 2, 0, maxTime, margin, margin + w);
        sketch.text('Default', midX, margin - 2);
      }
    }
  }

  // Time labels below chart area
  for (const t of linePoints) {
    const x = sketch.map(t, 0, maxTime, margin, margin + w);
    sketch.noStroke();
    sketch.fill(...boundaryColor);
    sketch.textAlign(sketch.CENTER, sketch.TOP);
    sketch.textSize(8);
    const label = t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`;
    sketch.text(label, x, margin + h + 16);
  }

  sketch.textSize(11);
}

function drawPositionIndicator(sketch, margin, w, h, maxTime) {
  if (typeof currentAnimTime !== 'undefined') {
    const xPos = sketch.map(currentAnimTime, 0, maxTime, margin, margin + w);

    if (xPos >= margin && xPos <= margin + w) {
      sketch.stroke(50);
      sketch.strokeWeight(2);
      sketch.line(xPos, margin, xPos, margin + h);

      sketch.fill(50);
      sketch.noStroke();
      sketch.triangle(xPos, margin + h, xPos - 5, margin + h + 10, xPos + 5, margin + h + 10);
    }
  }
}

function createSingleChart(seqIndex, containerDiv) {
  return new p5((sketch) => {
    let maxTime = 0;
    let margin = 40;
    let w = 0;
    let h = 0;

    sketch.setup = () => {
      const canvasWidth = containerDiv.clientWidth;
      const canvasHeight = containerDiv.clientHeight || 250;
      const canvas = sketch.createCanvas(canvasWidth, canvasHeight);
      canvas.parent(containerDiv);

      w = sketch.width - 2 * margin;
      h = sketch.height - 2 * margin;

      canvas.mousePressed(() => {
        isDragging = true;
        handleInteraction();
      });
    };

    sketch.windowResized = () => {
      const canvasWidth = containerDiv.clientWidth;
      sketch.resizeCanvas(canvasWidth, sketch.height);
      w = sketch.width - 2 * margin;
    };

    sketch.draw = () => {
      sketch.background(255);
      const leftSeq = sideData.left.sequences[seqIndex];
      const rightSeq = sideData.right.sequences[seqIndex];
      const leftData = parseForChart(leftSeq);
      const rightData = parseForChart(rightSeq);

      // Apply phase time offset to chart data
      const phaseOffset = getChannelPhaseOffset(seqIndex);

      if (phaseOffset > 0) {
        leftData.points = leftData.points.map(p => ({ t: p.t + phaseOffset, b: p.b }));
        leftData.maxT += phaseOffset;
        rightData.points = rightData.points.map(p => ({ t: p.t + phaseOffset, b: p.b }));
        rightData.maxT += phaseOffset;
      }

      const localMax = Math.max(leftData.maxT, rightData.maxT);
      maxTime = getChartMaxTime(localMax);
      if (maxTime === 0) maxTime = 1000;

      drawChartFrame(sketch, margin, w, h, maxTime);

      drawPhaseBoundaries(sketch, margin, w, h, maxTime);

      // Draw default brightness reference line if applicable
      if (currentPhaseTimeline) {
        const seq = leftSeq || rightSeq;
        if (seq && seq.identifier !== RAW_IDENTIFIER) {
          const chId = parseInt(seq.identifier, 16);
          const vehicleKey = document.getElementById("vehicleSelect").value;
          const config = VEHICLE_CONFIGS[vehicleKey];

          if (config && config.defaultStates && config.defaultStates[chId]) {
            const defaultBri = config.defaultStates[chId].brightness;
            const y = sketch.map(defaultBri, 0, 100, margin + h, margin);
            sketch.stroke(150, 150, 150);
            sketch.strokeWeight(1);
            sketch.drawingContext.setLineDash([3, 3]);
            sketch.line(margin, y, margin + w, y);
            sketch.drawingContext.setLineDash([]);
          }

          // Phase 2 channels with physicalLight start from default brightness
          if (config) {
            const chConfig = config.channels && config.channels.find(c => c.id === chId);
            if (chConfig && chConfig.physicalLight && config.defaultStates) {
              const defaultBri = (config.defaultStates[chConfig.physicalLight] || {}).brightness || 0;
              if (defaultBri > 0) {
                const y = sketch.map(defaultBri, 0, 100, margin + h, margin);
                sketch.stroke(150, 150, 150);
                sketch.strokeWeight(1);
                sketch.drawingContext.setLineDash([3, 3]);
                sketch.line(margin, y, margin + w, y);
                sketch.drawingContext.setLineDash([]);
              }
              if (leftData.points.length > 0) leftData.points[0].b = defaultBri;
              if (rightData.points.length > 0) rightData.points[0].b = defaultBri;
            }
          }
        }
      }

      const drawLine = (pts, color) => {
        if (!pts || pts.length === 0) return;
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        sketch.beginShape();
        for (const p of pts) {
          const x = sketch.map(p.t, 0, maxTime, margin, margin + w);
          const y = sketch.map(p.b, 0, 100, margin + h, margin);
          sketch.vertex(x, y);
        }
        sketch.endShape();
      };

      const drawSegment = (p1, p2, color) => {
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        const x1 = sketch.map(p1.t, 0, maxTime, margin, margin + w);
        const y1 = sketch.map(p1.b, 0, 100, margin + h, margin);
        const x2 = sketch.map(p2.t, 0, maxTime, margin, margin + w);
        const y2 = sketch.map(p2.b, 0, 100, margin + h, margin);
        sketch.line(x1, y1, x2, y2);
      };

      // Draw brightness curves with L/R color coding
      if (arePointsIdentical(leftData.points, rightData.points)) {
        drawLine(leftData.points, sketch.color(0, 180, 0)); // Green = identical
      } else {
        const lp = leftData.points;
        const rp = rightData.points;
        const maxPts = Math.max(lp.length, rp.length);

        for (let s = 0; s < maxPts - 1; s++) {
          const lHas = s + 1 < lp.length;
          const rHas = s + 1 < rp.length;
          const bothMatch = lHas && rHas &&
            lp[s].t === rp[s].t && lp[s].b === rp[s].b &&
            lp[s + 1].t === rp[s + 1].t && lp[s + 1].b === rp[s + 1].b;

          if (bothMatch) {
            drawSegment(lp[s], lp[s + 1], sketch.color(0, 180, 0));
          } else {
            if (lHas) drawSegment(lp[s], lp[s + 1], sketch.color(0, 0, 255));
            if (rHas) drawSegment(rp[s], rp[s + 1], sketch.color(255, 0, 0));
          }
        }
      }

      drawPositionIndicator(sketch, margin, w, h, maxTime);
    };

    let isDragging = false;

    const handleInteraction = () => {
      if (sketch.mouseX >= 0 && sketch.mouseX <= sketch.width &&
        sketch.mouseY >= 0 && sketch.mouseY <= sketch.height) {
        if (sketch.mouseX >= margin && sketch.mouseX <= margin + w) {
          let clickedTime = sketch.map(sketch.mouseX, margin, margin + w, 0, maxTime);
          if (clickedTime < 0) clickedTime = 0;
          if (clickedTime > maxTime) clickedTime = maxTime;

          seekAnimation(clickedTime);

          const seq = sideData['left'].sequences[seqIndex] || sideData['right'].sequences[seqIndex];
          const leftLight = getLightElement('left', seq, seqIndex);
          const rightLight = getLightElement('right', seq, seqIndex);
          if (leftLight) leftLight.classList.add('focused');
          if (rightLight) rightLight.classList.add('focused');

          return false;
        }
      }
    };

    const clearInteraction = () => {
      const seq = sideData['left'].sequences[seqIndex] || sideData['right'].sequences[seqIndex];
      const leftLight = getLightElement('left', seq, seqIndex);
      const rightLight = getLightElement('right', seq, seqIndex);
      if (leftLight) leftLight.classList.remove('focused');
      if (rightLight) rightLight.classList.remove('focused');
    };

    sketch.mouseDragged = () => {
      if (isDragging) {
        handleInteraction();
      }
    };

    sketch.mouseReleased = () => {
      if (isDragging) {
        isDragging = false;
        clearInteraction();
      }
    };

  });
}

function createSummaryChart(physicalChId, containerDiv, config) {
  return new p5((sketch) => {
    let maxTime = 0;
    let margin = 40;
    let w = 0;
    let h = 0;

    sketch.setup = () => {
      const canvasWidth = containerDiv.clientWidth;
      const canvasHeight = containerDiv.clientHeight || 250;
      const canvas = sketch.createCanvas(canvasWidth, canvasHeight);
      canvas.parent(containerDiv);

      w = sketch.width - 2 * margin;
      h = sketch.height - 2 * margin;

      canvas.mousePressed(() => {
        isDragging = true;
        handleInteraction();
      });
    };

    sketch.windowResized = () => {
      const canvasWidth = containerDiv.clientWidth;
      sketch.resizeCanvas(canvasWidth, sketch.height);
      w = sketch.width - 2 * margin;
    };

    sketch.draw = () => {
      sketch.background(250, 248, 245);
      if (!currentPhaseTimeline) return;

      maxTime = currentPhaseTimeline.totalDuration;
      if (maxTime === 0) maxTime = 1000;

      drawChartFrame(sketch, margin, w, h, maxTime);
      drawPerLightBoundaries(sketch, margin, w, h, maxTime, physicalChId, config);

      // Build sample times: regular intervals + exact sequence keyframe times
      const sampleCount = Math.min(w, 500);
      const regularStep = maxTime / sampleCount;
      const sampleTimes = new Set();
      for (let i = 0; i <= sampleCount; i++) {
        sampleTimes.add(i * regularStep);
      }

      // Add exact keyframe times from all controlling channels
      const controllingIds = [physicalChId];
      for (const ch of config.channels) {
        if (ch.physicalLight === physicalChId) controllingIds.push(ch.id);
      }
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

      const defaults = config.defaultStates || {};
      if (defaults[physicalChId]) {
        const defaultBri = defaults[physicalChId].brightness;
        if (defaultBri > 0) {
          const y = sketch.map(defaultBri, 0, 100, margin + h, margin);
          sketch.stroke(150, 150, 150);
          sketch.strokeWeight(1);
          sketch.drawingContext.setLineDash([3, 3]);
          sketch.line(margin, y, margin + w, y);
          sketch.drawingContext.setLineDash([]);
          sketch.noStroke();
          sketch.fill(150);
          sketch.textAlign(sketch.LEFT, sketch.BOTTOM);
          sketch.textSize(9);
          sketch.text(`Default: ${defaultBri}%`, margin + 3, y - 2);
          sketch.textSize(11);
        }
      }

      // Per-segment comparison: classify each segment by source type AND L/R match.
      // Group consecutive segments with same classification into polyline runs
      // so setLineDash renders correctly across the full span.
      const isDefaultSource = (src) => src === 'default' || src === 'rampUp' || src === 'rampDown';
      const briMatch = (i) => Math.abs(leftPoints[i].b - rightPoints[i].b) < 0.01;

      const segCount = leftPoints.length - 1;
      const segClass = [];
      for (let i = 0; i < segCount; i++) {
        const isDef = isDefaultSource(leftPoints[i].src) || isDefaultSource(rightPoints[i].src);
        const isMatch = briMatch(i) && briMatch(i + 1);
        segClass.push({ isDef, isMatch });
      }

      const greenColor = sketch.color(0, 180, 0);
      const blueColor = sketch.color(0, 0, 255);
      const redColor = sketch.color(255, 0, 0);

      const drawRun = (pts, startSeg, endSeg, color, isDef) => {
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        sketch.drawingContext.setLineDash(isDef ? [6, 4] : []);
        sketch.beginShape();
        for (let i = startSeg; i <= endSeg; i++) {
          const x = sketch.map(pts[i].t, 0, maxTime, margin, margin + w);
          const y = sketch.map(pts[i].b, 0, 100, margin + h, margin);
          sketch.vertex(x, y);
        }
        sketch.endShape();
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
          drawRun(leftPoints, runStart, runEnd + 1, greenColor, isDef);
        } else {
          drawRun(leftPoints, runStart, runEnd + 1, blueColor, isDef);
          drawRun(rightPoints, runStart, runEnd + 1, redColor, isDef);
        }

        runStart = runEnd + 1;
      }
      sketch.drawingContext.setLineDash([]);

      // Legend for channel vs default line styles
      const hasDefault = leftPoints.some(p => isDefaultSource(p.src))
        || rightPoints.some(p => isDefaultSource(p.src));
      if (hasDefault) {
        const lx = margin + w - 105;
        const ly = margin + h - 22;
        sketch.noStroke();
        sketch.fill(255, 255, 255, 200);
        sketch.rect(lx - 4, ly - 2, 110, 20, 3);

        sketch.stroke(greenColor);
        sketch.strokeWeight(2);
        sketch.drawingContext.setLineDash([]);
        sketch.line(lx, ly + 5, lx + 16, ly + 5);
        sketch.noStroke();
        sketch.fill(80);
        sketch.textAlign(sketch.LEFT, sketch.CENTER);
        sketch.textSize(8);
        sketch.text('Channel', lx + 19, ly + 5);

        sketch.stroke(greenColor);
        sketch.strokeWeight(2);
        sketch.drawingContext.setLineDash([6, 4]);
        sketch.line(lx + 58, ly + 5, lx + 74, ly + 5);
        sketch.drawingContext.setLineDash([]);
        sketch.noStroke();
        sketch.fill(80);
        sketch.text('Default', lx + 77, ly + 5);
        sketch.textSize(11);
      }

      drawPositionIndicator(sketch, margin, w, h, maxTime);
    };

    let isDragging = false;

    const handleInteraction = () => {
      if (sketch.mouseX >= 0 && sketch.mouseX <= sketch.width &&
        sketch.mouseY >= 0 && sketch.mouseY <= sketch.height) {
        if (sketch.mouseX >= margin && sketch.mouseX <= margin + w) {
          let clickedTime = sketch.map(sketch.mouseX, margin, margin + w, 0, maxTime);
          if (clickedTime < 0) clickedTime = 0;
          if (clickedTime > maxTime) clickedTime = maxTime;

          seekAnimation(clickedTime);

          for (const side of ['left', 'right']) {
            const el = document.getElementById(`${side}_light_ch${physicalChId}`);
            if (el) el.classList.add('focused');
          }

          return false;
        }
      }
    };

    const clearInteraction = () => {
      for (const side of ['left', 'right']) {
        const el = document.getElementById(`${side}_light_ch${physicalChId}`);
        if (el) el.classList.remove('focused');
      }
    };

    sketch.mouseDragged = () => {
      if (isDragging) {
        handleInteraction();
      }
    };

    sketch.mouseReleased = () => {
      if (isDragging) {
        isDragging = false;
        clearInteraction();
      }
    };
  });
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

function updateSingleDiagram(seqIndex) {
  const existing = chartSketches[seqIndex];
  if (existing) existing.remove();

  const chartDiv = document.getElementById(`chartCanvas_${seqIndex}`);
  chartSketches[seqIndex] = createSingleChart(seqIndex, chartDiv);
}

function cleanupSummaryCharts() {
  summaryChartSketches.forEach(s => { if (s && s.remove) s.remove(); });
  summaryChartSketches = [];
}
