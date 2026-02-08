// ============================================================================
// Animation: Playback, visualization, brightness interpolation
// ============================================================================
let animationId = null;
let isPlaying = false;
let lastFrameTime = 0;
let currentAnimTime = 0;
let totalDuration = 0;
let playbackSpeed = 1.0;

function rebuildAnimationPlayer() {
  const leftContainer = document.getElementById("leftLights");
  const rightContainer = document.getElementById("rightLights");
  leftContainer.innerHTML = "";
  rightContainer.innerHTML = "";

  const vehicleKey = document.getElementById("vehicleSelect").value;
  const config = VEHICLE_CONFIGS[vehicleKey] || VEHICLE_CONFIGS["generic"];

  if (config.type === "image") {
    setupImageVisualization(leftContainer, rightContainer, config);
  } else {
    setupGridVisualization(leftContainer, rightContainer);
  }

  // Calculate total duration (max of all sequences)
  totalDuration = 0;
  for (const side of ['left', 'right']) {
    for (const seq of sideData[side].sequences) {
      const dur = getSequenceDuration(seq);
      if (dur > totalDuration) totalDuration = dur;
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
  return el;
}

function setupImageVisualization(leftContainer, rightContainer, config) {
  const createSVG = (side) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", config.viewBox);
    svg.style.width = "450px"; // Slightly larger
    svg.style.height = "auto";
    svg.style.backgroundImage = `url('${config.image}')`;
    svg.style.backgroundSize = "cover";
    svg.style.borderRadius = "8px";
    svg.style.border = "1px solid #333";

    // Mirroring logic based on baseSide
    const baseSide = config.baseSide || "left";
    if (side !== baseSide) {
      svg.style.transform = "scaleX(-1)"; // Mirror the side that is not the base side
    }

    config.channels.forEach((channel, idx) => {
      let el;

      if (channel.shapes) {
        // Multi-shape channel: wrap in <g> group
        el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        channel.shapes.forEach(shapeDesc => {
          const child = createSVGShape(shapeDesc);
          if (child) el.appendChild(child);
        });
      } else {
        // Single-shape channel (backward compatible)
        el = createSVGShape(channel);
      }

      if (el) {
        el.id = `${side}_light_ch${channel.id}`;
        el.setAttribute("fill", "transparent");
        el.setAttribute("stroke", "transparent");
        el.setAttribute("stroke-width", "2");
        el.style.transition = "all 0.1s ease";
        // Add title for hover info
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

function getSequenceDuration(seq) {
  if (!seq || seq.identifier === "RAW") return 0;
  let t = 0;
  for (let i = 0; i < seq.data.length; i += 2) {
    let durHex = parseInt(seq.data[i], 16) || 0;
    // Real-world validation: 60fps recordings confirmed ×20 multiplier (BMW G20 2020)
    // See timing_analysis.md for detailed analysis
    t += durHex * 20;
  }
  return t;
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
  // If at end, restart
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
  if (seq && seq.identifier !== "RAW") {
    const el = document.getElementById(`${side}_light_ch${parseInt(seq.identifier, 16)}`);
    if (el) return el;
  }
  return document.getElementById(`${side}_light_${idx}`);
}

function updateVisuals(time) {
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

function applyBrightness(element, brightness) {
  const isSVG = element instanceof SVGElement;
  const val = Math.round((brightness / 100) * 255);

  if (isSVG) {
    // SVG styling
    if (brightness > 0) {
      const color = `rgba(255, 255, 255, ${brightness / 100})`;
      element.setAttribute("fill", color);
      element.setAttribute("stroke", color);

      if (!element.classList.contains('focused')) {
        element.style.filter = `drop-shadow(0 0 ${brightness / 10}px rgba(255, 255, 255, 0.8))`;
      }
    } else {
      element.setAttribute("fill", "transparent");
      element.setAttribute("stroke", "transparent");
      if (!element.classList.contains('focused')) {
        element.style.filter = "none";
      }
    }
  } else {
    // HTML div styling
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

function getBrightnessAtTime(seq, timeObj) {
  if (!seq || seq.identifier === "RAW") return 0;

  // Interpolation Logic matching the Chart
  let tStart = 0;
  let bStart = 0;

  for (let i = 0; i < seq.data.length; i += 2) {
    let durHex = parseInt(seq.data[i], 16) || 0;
    let briHex = parseInt(seq.data[i + 1], 16) || 0;
    // Real-world validation: 60fps recordings confirmed ×20 multiplier (BMW G20 2020)
    // See timing_analysis.md for detailed analysis
    let stepDur = durHex * 20;
    let bEnd = Math.min(briHex, 100);
    let tEnd = tStart + stepDur;

    if (timeObj >= tStart && timeObj <= tEnd) {
      // Interpolate
      if (stepDur === 0) return bEnd;
      let progress = (timeObj - tStart) / stepDur;
      return bStart + (bEnd - bStart) * progress;
    }

    tStart = tEnd;
    bStart = bEnd;
  }
  return bStart; // Hold last value
}
