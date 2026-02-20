let animationId = null;
let isPlaying = false;
let lastFrameTime = 0;
let currentAnimTime = 0;
let totalDuration = 0;
let playbackSpeed = 1.0;
let currentPhaseTimeline = null;

function rebuildAnimationPlayer() {
  const leftContainer = document.getElementById("leftLights");
  const rightContainer = document.getElementById("rightLights");
  leftContainer.innerHTML = "";
  rightContainer.innerHTML = "";

  const config = getActiveVehicleConfig() || VEHICLE_CONFIGS["generic"];

  if (config.type === "image") {
    setupImageVisualization(leftContainer, rightContainer, config);
  } else {
    setupGridVisualization(leftContainer, rightContainer);
  }

  currentPhaseTimeline = computePhaseTimeline(config, {
    left: sideData.left.sequences,
    right: sideData.right.sequences
  });

  if (currentPhaseTimeline) {
    totalDuration = currentPhaseTimeline.totalDuration;
  } else {
    totalDuration = 0;
    for (const side of ['left', 'right']) {
      for (const seq of sideData[side].sequences) {
        const dur = getSequenceDuration(seq);
        if (dur > totalDuration) totalDuration = dur;
      }
    }
  }

  const slider = document.getElementById("seekSlider");
  slider.max = totalDuration;
  slider.value = 0;
  document.getElementById("totalTimeDisplay").textContent = `${totalDuration} ms`;

  stopAnimation();
}

function setupGridVisualization(leftContainer, rightContainer) {
  const containers = { left: leftContainer, right: rightContainer };
  for (const side of ['left', 'right']) {
    sideData[side].sequences.forEach((seq, idx) => {
      const div = document.createElement("div");
      div.className = "light-bulb";
      div.dataset.index = idx + 1;
      div.id = `${side}_light_${idx}`;
      containers[side].appendChild(div);
    });
  }
}

function createSVGShape(shapeDesc) {
  let el;
  if (shapeDesc.type === "path") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", shapeDesc.d);
  } else if (shapeDesc.type === "circle") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("cx", shapeDesc.cx);
    el.setAttribute("cy", shapeDesc.cy);
    el.setAttribute("r", shapeDesc.r);
  } else if (shapeDesc.type === "polygon") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    el.setAttribute("points", shapeDesc.points);
  } else if (shapeDesc.type === "rect") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("x", shapeDesc.x);
    el.setAttribute("y", shapeDesc.y);
    el.setAttribute("width", shapeDesc.width);
    el.setAttribute("height", shapeDesc.height);
    if (shapeDesc.rx) el.setAttribute("rx", shapeDesc.rx);
    if (shapeDesc.ry) el.setAttribute("ry", shapeDesc.ry);
  }
  if (el && shapeDesc.color) {
    el.setAttribute("data-color", shapeDesc.color);
  }
  return el;
}

function parseHexColor(hex) {
  hex = hex.replace('#', '');
  let r, g, b, a = 1;
  if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16) / 255;
  }
  return { r: r || 0, g: g || 0, b: b || 0, a };
}

function setupImageVisualization(leftContainer, rightContainer, config) {
  const createSVG = (side) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", config.viewBox);
    // SVG container with background vehicle image
    svg.style.width = "450px";
    svg.style.height = "auto";
    svg.style.backgroundImage = `url('${config.image}')`;
    svg.style.backgroundSize = "cover";
    svg.style.borderRadius = "8px";
    svg.style.border = "1px solid #333";

    // Mirror non-base side horizontally
    const baseSide = config.baseSide || "left";
    if (side !== baseSide) {
      svg.style.transform = "scaleX(-1)";
    }

    // Create SVG shapes for each light channel
    config.channels.forEach((channel, idx) => {
      if (channel.physicalLight) return;

      let el;

      if (channel.shapes) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        channel.shapes.forEach(shapeDesc => {
          const child = createSVGShape(shapeDesc);
          if (child) el.appendChild(child);
        });
      } else if (channel.type) {
        el = createSVGShape(channel);
      }

      if (el) {
        el.id = `${side}_light_ch${channel.id}`;
        el.setAttribute("fill", "transparent");
        el.setAttribute("stroke", "transparent");
        el.setAttribute("stroke-width", "2");
        el.style.transition = "all 0.1s ease";
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = channel.label || `Channel ${idx + 1}`;
        el.appendChild(title);
        svg.appendChild(el);
      }
    });
    return svg;
  };

  leftContainer.appendChild(createSVG("left"));
  rightContainer.appendChild(createSVG("right"));
}

function changeSpeed(val) {
  playbackSpeed = parseFloat(val);
}

function togglePlay() {
  if (isPlaying) {
    pauseAnimation();
  } else {
    startAnimation();
  }
}

function startAnimation() {
  if (isPlaying) return;
  if (currentAnimTime >= totalDuration && totalDuration > 0) {
    currentAnimTime = 0;
  }

  isPlaying = true;
  lastFrameTime = performance.now();
  animationLoop();
}

function pauseAnimation() {
  isPlaying = false;
  if (animationId) cancelAnimationFrame(animationId);
}

function stopAnimation() {
  pauseAnimation();
  currentAnimTime = 0;
  updateVisuals(0);
  updateControls(0);
}

function seekAnimation(val) {
  currentAnimTime = parseFloat(val);
  if (!isPlaying) {
    updateVisuals(currentAnimTime);
    updateControls(currentAnimTime);
  } else {
    lastFrameTime = performance.now();
  }
}

function animationLoop() {
  if (!isPlaying) return;
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  currentAnimTime += delta * playbackSpeed;

  if (currentAnimTime >= totalDuration) {
    currentAnimTime = totalDuration;
    updateVisuals(currentAnimTime);
    updateControls(currentAnimTime);
    pauseAnimation();
    return;
  }

  updateVisuals(currentAnimTime);
  updateControls(currentAnimTime);

  animationId = requestAnimationFrame(animationLoop);
}

function updateControls(time) {
  document.getElementById("seekSlider").value = time;
  document.getElementById("timeDisplay").textContent = `${Math.floor(time)} ms`;
}

function getLightElement(side, seq, idx) {
  if (seq && seq.identifier !== RAW_IDENTIFIER) {
    const channelId = parseInt(seq.identifier, 16);

    // Resolve physicalLight alias to referenced channel's SVG element
    const config = getActiveVehicleConfig();
    if (config && config.channels) {
      const channel = config.channels.find(ch => ch.id === channelId);
      if (channel && channel.physicalLight) {
        const el = document.getElementById(`${side}_light_ch${channel.physicalLight}`);
        if (el) return el;
      }
    }

    const el = document.getElementById(`${side}_light_ch${channelId}`);
    if (el) return el;
  }
  return document.getElementById(`${side}_light_${idx}`);
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

function findSequenceByChannelId(side, channelId) {
  const chHex = channelId.toString(16).padStart(2, "0").toUpperCase();
  for (const seq of sideData[side].sequences) {
    if (seq && seq.identifier && seq.identifier.toUpperCase() === chHex) return seq;
  }
  return null;
}

function getControllingChannelsSorted(physicalChId, config, timeline) {
  const channels = [physicalChId];
  for (const ch of config.channels) {
    if (ch.physicalLight === physicalChId) channels.push(ch.id);
  }
  channels.sort((a, b) => {
    const phaseA = timeline.channelPhaseMap[a] !== undefined ? timeline.channelPhaseMap[a] : -1;
    const phaseB = timeline.channelPhaseMap[b] !== undefined ? timeline.channelPhaseMap[b] : -1;
    return phaseA - phaseB;
  });
  return channels;
}

function resolvePhysicalLightPhase(physicalChId, time, side, config) {
  if (!currentPhaseTimeline) return null;
  const timeline = currentPhaseTimeline;
  const defaults = config.defaultStates || {};
  const controllingChannels = getControllingChannelsSorted(physicalChId, config, timeline);

  for (let channelIndex = 0; channelIndex < controllingChannels.length; channelIndex++) {
    const chId = controllingChannels[channelIndex];
    const phaseIdx = timeline.channelPhaseMap[chId];
    if (phaseIdx === undefined) continue;

    const phase = timeline.phases[phaseIdx];
    const seq = findSequenceByChannelId(side, chId);
    const seqDur = seq ? getSequenceDuration(seq) : 0;
    const effectiveEnd = phase.maxDuration !== null
      ? Math.min(phase.start + seqDur, phase.start + phase.maxDuration)
      : phase.start + seqDur;

    if (time >= phase.start && time < effectiveEnd) {
      const localTime = time - phase.start;
      if (phase.maxDuration !== null && localTime >= phase.maxDuration) return { state: 'capped' };
      return { state: 'active', channelIndex, phase, seq, localTime };
    }

    // Check for gap between phases
    const nextChannelIndex = channelIndex + 1;
    if (nextChannelIndex < controllingChannels.length) {
      const nextChId = controllingChannels[nextChannelIndex];
      const nextPhaseIdx = timeline.channelPhaseMap[nextChId];
      if (nextPhaseIdx !== undefined) {
        const nextPhase = timeline.phases[nextPhaseIdx];
        if (time >= effectiveEnd && time < nextPhase.start) {
          const defaultState = defaults[physicalChId] || { brightness: 0 };
          const defaultBri = defaultState.brightness || 0;
          const rampUp = defaultState.rampUp || 0;
          const rampDown = defaultState.rampDown || 0;
          const gapStart = effectiveEnd;
          const gapEnd = nextPhase.start;

          if (rampUp > 0 && time < gapStart + rampUp) {
            const lastBri = seq ? getBrightnessAtTime(seq, effectiveEnd - phase.start) : 0;
            return { state: 'rampUp', gapStart, lastBri, defaultBri, rampUp };
          }
          if (rampDown > 0 && time > gapEnd - rampDown) {
            return { state: 'rampDown', defaultBri };
          }
          return { state: 'default', defaultBri };
        }
      }
    }
  }

  return { state: 'off' };
}

function getPhysicalLightBrightness(physicalChId, time, side, config) {
  if (!currentPhaseTimeline) return 0;
  const defaults = config.defaultStates || {};
  const result = resolvePhysicalLightPhase(physicalChId, time, side, config);
  if (!result) return 0;

  switch (result.state) {
    case 'active': {
      // Phase 2+ starts from default brightness; Phase 1 starts from 0
      let initBri = 0;
      if (result.channelIndex > 0) {
        const defaultState = defaults[physicalChId];
        initBri = defaultState ? (defaultState.brightness || 0) : 0;
      }
      return result.seq ? getBrightnessAtTime(result.seq, result.localTime, initBri) : 0;
    }
    case 'rampUp': {
      const progress = (time - result.gapStart) / result.rampUp;
      return result.lastBri + (result.defaultBri - result.lastBri) * progress;
    }
    case 'rampDown':
    case 'default':
      return result.defaultBri;
    case 'capped':
    case 'off':
    default:
      return 0;
  }
}

function getPhysicalLightSource(physicalChId, time, side, config) {
  if (!currentPhaseTimeline) return 'off';
  const result = resolvePhysicalLightPhase(physicalChId, time, side, config);
  if (!result) return 'off';

  switch (result.state) {
    case 'active': return 'channel';
    case 'rampUp': return 'rampUp';
    case 'rampDown': return 'rampDown';
    case 'default': return 'default';
    case 'capped':
    case 'off':
    default:
      return 'off';
  }
}

function updateVisuals(time) {
  updateAllChartPositionIndicators(time);

  // Phase-aware rendering path
  if (currentPhaseTimeline) {
    const config = getActiveVehicleConfig() || VEHICLE_CONFIGS["generic"];

    if (config.channels) {
      for (const side of ['left', 'right']) {
        for (const channel of config.channels) {
          if (channel.physicalLight) continue;

          const el = document.getElementById(`${side}_light_ch${channel.id}`);
          if (!el) continue;

          const hasPhysicalRefs = config.channels.some(ch => ch.physicalLight === channel.id);

          if (hasPhysicalRefs) {
            const bri = getPhysicalLightBrightness(channel.id, time, side, config);
            applyBrightness(el, bri);
          } else {
            const phaseIdx = currentPhaseTimeline.channelPhaseMap[channel.id];
            if (phaseIdx !== undefined) {
              const phase = currentPhaseTimeline.phases[phaseIdx];
              const seq = findSequenceByChannelId(side, channel.id);
              const localTime = time - phase.start;
              if (time >= phase.start && time < phase.end && localTime >= 0) {
                const cappedTime = (phase.maxDuration !== null)
                  ? Math.min(localTime, phase.maxDuration)
                  : localTime;
                if (phase.maxDuration !== null && localTime >= phase.maxDuration) {
                  applyBrightness(el, 0);
                } else {
                  const bri = seq ? getBrightnessAtTime(seq, cappedTime) : 0;
                  applyBrightness(el, bri);
                }
              } else {
                applyBrightness(el, 0);
              }
            } else {
              applyBrightness(el, 0);
            }
          }
        }
      }
    }
  } else { // Legacy path: direct sequence-to-light mapping
    for (const side of ['left', 'right']) {
      sideData[side].sequences.forEach((seq, idx) => {
        const el = getLightElement(side, seq, idx);
        if (el) {
          const bri = getBrightnessAtTime(seq, time);
          applyBrightness(el, bri);
        }
      });
    }
  }
}

function applyBrightness(element, brightness) {
  const isSVG = element instanceof SVGElement;
  const val = Math.round((brightness / 100) * 255);

  // SVG elements: modulate fill/stroke color alpha
  if (isSVG) {
    const isGroup = element.tagName === 'g';
    const shapes = isGroup
      ? Array.from(element.children).filter(c => c.tagName !== 'title')
      : [element];

    if (brightness > 0) {
      const defaultColor = `rgba(255, 255, 255, ${brightness / 100})`;
      for (const shape of shapes) {
        const baseColor = shape.getAttribute('data-color');
        let color;
        if (baseColor) {
          const { r, g, b, a } = parseHexColor(baseColor);
          color = `rgba(${r}, ${g}, ${b}, ${(brightness / 100) * a})`;
        } else {
          color = defaultColor;
        }
        shape.setAttribute("fill", color);
        shape.setAttribute("stroke", color);
      }

      if (!element.classList.contains('focused')) {
        element.style.filter = `drop-shadow(0 0 ${brightness / 10}px rgba(255, 255, 255, 0.8))`;
      }
    } else {
      for (const shape of shapes) {
        shape.setAttribute("fill", "transparent");
        shape.setAttribute("stroke", "transparent");
      }
      if (!element.classList.contains('focused')) {
        element.style.filter = "none";
      }
    }
  } else { // HTML div elements: modulate background grayscale
    element.style.backgroundColor = `rgb(${val}, ${val}, ${val})`;
    if (brightness > 0) {
      element.style.boxShadow = `0 0 ${brightness / 3}px rgba(255, 255, 255, ${brightness / 100})`;
      element.style.borderColor = `rgb(${val}, ${val}, ${val})`;
    } else {
      element.style.boxShadow = `none`;
      element.style.borderColor = `#555`;
    }
  }
}

function getBrightnessAtTime(seq, time, initialBrightness) {
  if (!seq || seq.identifier === RAW_IDENTIFIER) return 0;

  let tStart = 0;
  let bStart = (initialBrightness !== undefined) ? initialBrightness : 0;

  for (let i = 0; i < seq.data.length; i += 2) {
    const durHex = parseInt(seq.data[i], 16) || 0;
    const briHex = parseInt(seq.data[i + 1], 16) || 0;
    const stepDur = durHex * TIME_MULTIPLIER;
    const bEnd = Math.min(briHex, 100);
    const tEnd = tStart + stepDur;

    if (time >= tStart && time <= tEnd) {
      if (stepDur === 0) return bEnd;
      const progress = (time - tStart) / stepDur;
      return bStart + (bEnd - bStart) * progress;
    }

    tStart = tEnd;
    bStart = bEnd;
  }
  return bStart;
}
