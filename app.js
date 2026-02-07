// ============================================================================
// Global const and helper functions
// ============================================================================
const MAX_STAGING1 = 252;
const MAX_STAGING2 = 168;

// Unified side data structure
const sideData = {
  left:  { staging1Bytes: [], staging2Bytes: [], sequences: [] },
  right: { staging1Bytes: [], staging2Bytes: [], sequences: [] }
};

function parseByteString(str) {
  if (!str) return [];
  let arr = str.replace(/\s/g, "").split(",");
  return arr.map(x => x.trim()).filter(x => x !== "");
}
function buildByteString(arr) {
  return arr.map(x => x.trim()).join(", ");
}
function ensureMaxSize(arr, maxSize) {
  if (arr.length > maxSize) {
    console.warn(`Exceeded Byte-limit: wanted ${maxSize}, have ${arr.length}. Trimming...`);
    arr.length = maxSize;
  }
}

function updateUsageUI(side, totalLen) {
  const totalMax = MAX_STAGING1 + MAX_STAGING2;
  const overMax = totalLen > totalMax;

  const c1 = document.getElementById(`counter_${side}Staging1`);
  const c2 = document.getElementById(`counter_${side}Staging2`);
  const l1 = document.getElementById(`label_${side}Staging1`);
  const l2 = document.getElementById(`label_${side}Staging2`);
  const i1 = document.getElementById(`${side}Staging1`);
  const i2 = document.getElementById(`${side}Staging2`);

  if (c1) c1.textContent = `(${Math.min(totalLen, MAX_STAGING1)} / ${MAX_STAGING1} Bytes)`;
  if (c2) c2.textContent = `(${Math.max(0, Math.min(totalLen - MAX_STAGING1, MAX_STAGING2))} / ${MAX_STAGING2} Bytes)`;

  const method = overMax ? "add" : "remove";
  if (l1) l1.classList[method]("overflow-error");
  if (l2) l2.classList[method]("overflow-error");
  if (i1) i1.classList[method]("overflow-error");
  if (i2) i2.classList[method]("overflow-error");
}

// ============================================================================
// Copy to Clipboard function
// ============================================================================
function copyToClipboard(fieldId) {
  const text = document.getElementById(fieldId).value;
  navigator.clipboard.writeText(text)
    .then(() => {
      console.log("Copied to clipboard:", text);
    })
    .catch(err => {
      console.error("Failed to copy!", err);
    });
}

// ============================================================================
// Paste from Clipboard function
// ============================================================================
function pasteFromClipboard(fieldId) {
  navigator.clipboard.readText()
    .then(text => {
      document.getElementById(fieldId).value = text;
      console.log("Pasted from clipboard into", fieldId, ":", text);
    })
    .catch(err => {
      console.error("Failed to paste!", err);
    });
}

// ============================================================================
// Clear all Fields function
// ============================================================================
function clearAllFields() {
  document.getElementById("leftStaging1").value = "";
  document.getElementById("leftStaging2").value = "";
  document.getElementById("rightStaging1").value = "";
  document.getElementById("rightStaging2").value = "";
}

// ============================================================================
// 1) Chart sketches and edit mode state
// ============================================================================
let chartSketches = [];

// Edit mode state: 'hex' or 'visual' per sequence
let editModes = { left: {}, right: {} };

// ============================================================================
// Visual Editor Functions
// ============================================================================
function toggleEditMode(side, seqIndex, mode) {
  editModes[side][seqIndex] = mode;
  renderSequenceEditor(side, seqIndex);
}

function renderSequenceEditor(side, seqIndex) {
  const container = document.getElementById(`editor_${side}_${seqIndex}`);
  if (!container) return;

  const mode = editModes[side][seqIndex] || 'hex';
  const seq = sideData[side].sequences[seqIndex];

  // Update toggle buttons
  const toggleDiv = container.querySelector('.editor-toggle');
  if (toggleDiv) {
    toggleDiv.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  // Get or create content container
  let contentDiv = container.querySelector('.editor-content');
  if (!contentDiv) {
    contentDiv = document.createElement('div');
    contentDiv.className = 'editor-content';
    container.appendChild(contentDiv);
  }

  if (mode === 'hex') {
    renderHexEditor(contentDiv, side, seqIndex, seq);
  } else {
    renderVisualEditor(contentDiv, side, seqIndex, seq);
  }
}

function renderHexEditor(container, side, seqIndex, seq) {
  container.innerHTML = '';
  const ta = document.createElement('textarea');
  ta.value = seq ? sequenceToString(seq) : '';
  ta.style.width = '100%';
  ta.style.height = '60px';
  ta.style.fontFamily = 'monospace';
  ta.style.fontSize = '11px';
  ta.oninput = (e) => {
    sideData[side].sequences[seqIndex] = stringToSequence(e.target.value);
    reAssembleBytes(side);
    updateSingleDiagram(seqIndex);
    updateSeqLabels(seqIndex);
    updateVisuals(currentAnimTime);
  };
  container.appendChild(ta);
}

function renderVisualEditor(container, side, seqIndex, seq) {
  container.innerHTML = '';

  if (!seq || seq.identifier === 'RAW') {
    container.innerHTML = '<p style="color:#999;font-size:12px;">RAW data - use hex mode to edit</p>';
    return;
  }

  const editorDiv = document.createElement('div');
  editorDiv.className = 'visual-editor';

  // Parse steps from seq.data (pairs of duration, brightness)
  const steps = [];
  for (let i = 0; i < seq.data.length; i += 2) {
    const durHex = parseInt(seq.data[i], 16) || 0;
    const briHex = parseInt(seq.data[i + 1], 16) || 0;
    steps.push({ duration: durHex, brightness: Math.min(briHex, 100) });
  }

  steps.forEach((step, stepIdx) => {
    const row = document.createElement('div');
    row.className = 'step-row';

    // Step label
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = `#${stepIdx + 1}`;
    row.appendChild(label);

    // Duration field - with number input
    const durField = document.createElement('div');
    durField.className = 'step-field';
    durField.innerHTML = `
      <label>Duration:</label>
      <input type="range" min="0" max="255" value="${step.duration}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="duration">
      <input type="number" min="0" max="2550" step="10" value="${step.duration * 10}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="duration">
      <span class="value-display">ms</span>
    `;
    row.appendChild(durField);

    // Brightness field - with number input
    const briField = document.createElement('div');
    briField.className = 'step-field';
    briField.innerHTML = `
      <label>Brightness:</label>
      <input type="range" min="0" max="100" value="${step.brightness}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="brightness">
      <input type="number" min="0" max="100" value="${step.brightness}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="brightness">
      <span class="value-display">%</span>
    `;
    row.appendChild(briField);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'step-remove';
    removeBtn.textContent = '\u2715';
    removeBtn.onclick = () => removeStep(side, seqIndex, stepIdx);
    row.appendChild(removeBtn);

    editorDiv.appendChild(row);
  });

  // Add event listeners for sliders - sync to number input
  editorDiv.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.oninput = (e) => {
      const { side: s, seq: si, step: sti, type } = e.target.dataset;
      const val = parseInt(e.target.value);

      // Update number input
      const numInput = e.target.nextElementSibling;
      if (type === 'duration') {
        numInput.value = val * 10;
      } else {
        numInput.value = val;
      }

      // Update sequence data
      updateStepValue(s, parseInt(si), parseInt(sti), type, val);
    };
  });

  // Add event listeners for number inputs - sync to slider
  editorDiv.querySelectorAll('input[type="number"]').forEach(numInput => {
    numInput.oninput = (e) => {
      const { side: s, seq: si, step: sti, type } = e.target.dataset;
      let inputVal = parseInt(e.target.value) || 0;

      // Clamp and convert to internal value
      let val;
      if (type === 'duration') {
        inputVal = Math.max(0, Math.min(2550, inputVal));
        val = Math.round(inputVal / 10);
      } else {
        val = Math.max(0, Math.min(100, inputVal));
      }

      // Update slider
      const slider = e.target.previousElementSibling;
      slider.value = val;

      // Update sequence data
      updateStepValue(s, parseInt(si), parseInt(sti), type, val);
    };
  });

  // Add step button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-step-btn';
  addBtn.textContent = '+ Add Step';
  addBtn.onclick = () => addStep(side, seqIndex);
  editorDiv.appendChild(addBtn);

  container.appendChild(editorDiv);
}

function copySequence(fromSide, seqIndex) {
  const toSide = fromSide === 'left' ? 'right' : 'left';
  const fromSeq = sideData[fromSide].sequences[seqIndex];

  if (!fromSeq) return;

  // Deep copy the sequence
  sideData[toSide].sequences[seqIndex] = {
    identifier: fromSeq.identifier,
    lengthVal: fromSeq.lengthVal,
    data: [...fromSeq.data]
  };

  reAssembleBytes(toSide);

  // Re-render the target editor and update diagram
  renderSequenceEditor(toSide, seqIndex);
  updateSingleDiagram(seqIndex);
  updateVisuals(currentAnimTime);
}

function updateStepValue(side, seqIndex, stepIndex, type, value) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  const dataIdx = stepIndex * 2 + (type === 'duration' ? 0 : 1);
  if (dataIdx < seq.data.length) {
    seq.data[dataIdx] = value.toString(16).toUpperCase().padStart(2, '0');

    // Recalculate length if needed (lengthVal = number of step pairs)
    seq.lengthVal = Math.floor(seq.data.length / 2);

    reAssembleBytes(side);
    updateSingleDiagram(seqIndex);
    updateVisuals(currentAnimTime);
  }
}

function addStep(side, seqIndex) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  // Add default step: 10 (100ms), 00 (0%)
  seq.data.push('0A', '00');
  seq.lengthVal = Math.floor(seq.data.length / 2);

  reAssembleBytes(side);
  updateSingleDiagram(seqIndex);
  updateVisuals(currentAnimTime);
  renderSequenceEditor(side, seqIndex);
}

function removeStep(side, seqIndex, stepIndex) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  // Remove 2 bytes for this step
  const dataIdx = stepIndex * 2;
  if (dataIdx < seq.data.length) {
    seq.data.splice(dataIdx, 2);
    seq.lengthVal = Math.floor(seq.data.length / 2);

    reAssembleBytes(side);
    updateSingleDiagram(seqIndex);
    updateVisuals(currentAnimTime);
    renderSequenceEditor(side, seqIndex);
  }
}

// ============================================================================
function calculateSeqsSize(seqs) {
  let total = 0;
  for (let s of seqs) {
    if (s.identifier === "RAW") {
      total += s.data.length;
    } else {
      total += 3 + s.data.length; // Identifier (1) + Length (2)
    }
  }
  return total;
}

// 2) Main work
// ============================================================================
function buildDynamicFields() {
  for (const side of ['left', 'right']) {
    const sd = sideData[side];

    // Read the main input fields
    const s1 = document.getElementById(`${side}Staging1`).value;
    const s2 = document.getElementById(`${side}Staging2`).value;

    // Parse into byte arrays
    sd.staging1Bytes = parseByteString(s1);
    sd.staging2Bytes = parseByteString(s2);

    // Check length
    ensureMaxSize(sd.staging1Bytes, MAX_STAGING1);
    ensureMaxSize(sd.staging2Bytes, MAX_STAGING2);

    // Extract sequences
    sd.sequences = parseAllSequencesFromBytes(sd.staging1Bytes, sd.staging2Bytes);

    // Update UI counters (excluding padding)
    updateUsageUI(side, calculateSeqsSize(sd.sequences));
  }

  // Create dynamic fields
  renderDynamicSequences();
  rebuildAnimationPlayer();
}

// ============================================================================
// Template Loading Logic
// ============================================================================
function initTemplates() {
  const select = document.getElementById('templateSelect');
  if (typeof TEMPLATES === 'undefined') {
    console.warn('TEMPLATES not found. Make sure templates.js is loaded.');
    return;
  }

  for (const key of Object.keys(TEMPLATES)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key;
    select.appendChild(option);
  }
}

function initVehicles() {
  const select = document.getElementById('vehicleSelect');
  if (typeof VEHICLE_CONFIGS === 'undefined') {
    console.warn('VEHICLE_CONFIGS not found. Make sure vehicles.js is loaded.');
    return;
  }

  select.innerHTML = "";
  for (const key of Object.keys(VEHICLE_CONFIGS)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = VEHICLE_CONFIGS[key].name || key;
    select.appendChild(option);
  }
}

function loadSelectedTemplate() {
  const select = document.getElementById('templateSelect');
  const key = select.value;

  if (!key || !TEMPLATES[key]) return;

  const data = TEMPLATES[key];

  // Update inputs
  document.getElementById('leftStaging1').value = data.left1 || "";
  document.getElementById('leftStaging2').value = data.left2 || "";
  document.getElementById('rightStaging1').value = data.right1 || "";
  document.getElementById('rightStaging2').value = data.right2 || "";

  // Automatically parse and build
  buildDynamicFields();
}

// Initialize templates on load
window.addEventListener('DOMContentLoaded', initTemplates);

function parseAllSequencesFromBytes(arr1, arr2) {
  const combined = arr1.concat(arr2);
  let idx = 0;
  let seqs = [];

  while (idx + 3 <= combined.length) {
    // Break if "00,00,00"
    if (combined[idx] === "00" &&
      combined[idx + 1] === "00" &&
      combined[idx + 2] === "00") {
      idx += 3;
      break;
    }
    const identifier = combined[idx];
    const lenHigh = combined[idx + 1];
    const lenLow = combined[idx + 2];
    idx += 3;

    const lengthVal = parseInt(lenHigh + lenLow, 16);
    if (isNaN(lengthVal)) break;

    const dataByteCount = lengthVal * 2;
    let endPos = idx + dataByteCount;
    if (endPos > combined.length) {
      console.warn("Sequence data incomplete, break.");
      break;
    }
    const data = combined.slice(idx, endPos);
    idx = endPos;

    seqs.push({ identifier, lengthVal, data });
  }

  // leftover => RAW if not pure padding
  let leftover = combined.slice(idx);
  // Only add as RAW if there are non-zero bytes in the remnant
  const hasContent = leftover.some(b => b !== "00" && b !== "0");
  if (hasContent) {
    seqs.push({ identifier: "RAW", lengthVal: leftover.length, data: leftover });
  }
  return seqs;
}

/**
 * Dynamic fields and diagrams
 */
function renderDynamicSequences() {
  const container = document.getElementById("dynamicContainer");

  // Cleanup old sketches to prevent memory leaks and ghost interactions
  chartSketches.forEach(s => { if (s && s.remove) s.remove(); });
  chartSketches = [];

  // Sticky Checkbox and Logic
  const playerDiv = document.getElementById("animationPlayer");
  const controlsDiv = playerDiv.querySelector(".controls");

  // Check if sticky checkbox already exists, if not create it
  if (!document.getElementById("stickyToggle")) {
    const stickyLabel = document.createElement("label");
    stickyLabel.style.display = "flex";
    stickyLabel.style.alignItems = "center";
    stickyLabel.style.gap = "5px";
    stickyLabel.style.marginLeft = "auto";
    stickyLabel.style.cursor = "pointer";

    const stickyInput = document.createElement("input");
    stickyInput.type = "checkbox";
    stickyInput.id = "stickyToggle";
    stickyInput.onchange = (e) => {
      if (e.target.checked) {
        playerDiv.classList.add("sticky");
      } else {
        playerDiv.classList.remove("sticky");
      }
    };

    stickyLabel.appendChild(stickyInput);
    stickyLabel.appendChild(document.createTextNode("Sticky Player"));
    controlsDiv.appendChild(stickyLabel);
  }

  container.innerHTML = "";

  // Number of blocks
  const maxSeq = Math.max(sideData.left.sequences.length, sideData.right.sequences.length);

  for (let i = 0; i < maxSeq; i++) {
    const seqBlock = document.createElement("div");
    seqBlock.className = "seq-block";

    seqBlock.appendChild(createSeqSubblock('left', i));
    seqBlock.appendChild(createSeqSubblock('right', i));

    let chartDiv = document.createElement("div");
    chartDiv.id = `chartCanvas_${i}`;
    chartDiv.className = "chartCanvas";
    chartDiv.style.height = "250px";
    const labelSpan = document.createElement('span');
    labelSpan.className = 'diagram-label';
    labelSpan.textContent = getDiagramLabel(i);
    chartDiv.appendChild(labelSpan);
    seqBlock.appendChild(chartDiv);

    container.appendChild(seqBlock);

    // Initialize editors with default mode (hex)
    editModes.left[i] = editModes.left[i] || 'hex';
    editModes.right[i] = editModes.right[i] || 'hex';
    renderSequenceEditor('left', i);
    renderSequenceEditor('right', i);

    // Initial p5 Sketch
    chartSketches[i] = createSingleChart(i, chartDiv);
  }
}

function getChannelName(channelId) {
  const vehicleSelect = document.getElementById("vehicleSelect");
  if (!vehicleSelect) return null;
  const config = VEHICLE_CONFIGS[vehicleSelect.value];
  if (!config || !config.channels) return null;
  const channel = config.channels.find(ch => ch.id === channelId);
  return channel ? channel.label : null;
}

function getSeqLabel(side, seqIndex) {
  const label = side === 'left' ? 'Left' : 'Right';
  const seq = sideData[side].sequences[seqIndex];
  if (!seq) return `Ch ${label} #${seqIndex + 1}`;
  if (seq.identifier === 'RAW') return `RAW ${label}`;
  const chNum = parseInt(seq.identifier, 16);
  const chName = getChannelName(chNum);
  if (chName) return `${chName} — ${label} (Ch ${chNum})`;
  return `Ch ${label} ${chNum} (0x${seq.identifier.toUpperCase()})`;
}

function getDiagramLabel(seqIndex) {
  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const leftId = leftSeq && leftSeq.identifier !== 'RAW' ? leftSeq.identifier : null;
  const rightId = rightSeq && rightSeq.identifier !== 'RAW' ? rightSeq.identifier : null;
  if (leftId && rightId) {
    if (leftId.toUpperCase() === rightId.toUpperCase()) {
      const chNum = parseInt(leftId, 16);
      const chName = getChannelName(chNum);
      if (chName) return `${chName} — Diagram (Ch ${chNum})`;
      return `Diagram Ch ${chNum} (0x${leftId.toUpperCase()})`;
    }
    const lNum = parseInt(leftId, 16);
    const rNum = parseInt(rightId, 16);
    const lName = getChannelName(lNum);
    const rName = getChannelName(rNum);
    if (lName && rName) return `${lName} / ${rName} — Diagram`;
    return `Diagram Ch ${lNum} (0x${leftId.toUpperCase()}) / Ch ${rNum} (0x${rightId.toUpperCase()})`;
  }
  return `Diagram #${seqIndex + 1}`;
}

function updateSeqLabels(seqIndex) {
  for (const side of ['left', 'right']) {
    const span = document.querySelector(`[data-label-side="${side}"][data-label-seq="${seqIndex}"]`);
    if (span) span.textContent = getSeqLabel(side, seqIndex);
  }
  const chartDiv = document.getElementById(`chartCanvas_${seqIndex}`);
  if (chartDiv) {
    const labelEl = chartDiv.querySelector('.diagram-label');
    if (labelEl) labelEl.textContent = getDiagramLabel(seqIndex);
  }
}

function createSeqSubblock(side, seqIndex) {
  const isLeft = (side === 'left');
  const label = isLeft ? 'Left' : 'Right';
  const otherSide = isLeft ? 'Right' : 'Left';
  const arrow = isLeft ? '\u2192' : '\u2190';
  const copyTitle = `Copy ${label} \u2192 ${otherSide}`;

  const sub = document.createElement("div");
  sub.className = "seq-subblock";

  const h4 = document.createElement("h4");
  h4.style.display = "flex";
  h4.style.justifyContent = "space-between";
  h4.style.alignItems = "center";
  if (!isLeft) {
    h4.style.flexDirection = "row-reverse";
  }
  const seqLabel = getSeqLabel(side, seqIndex);
  h4.innerHTML = `<span data-label-side="${side}" data-label-seq="${seqIndex}">${seqLabel}</span> <button class="mini-copy-btn" onclick="copySequence('${side}', ${seqIndex})" title="${copyTitle}">${arrow}</button>`;
  sub.appendChild(h4);

  // Editor container with toggle
  const editor = document.createElement("div");
  editor.id = `editor_${side}_${seqIndex}`;

  const toggle = document.createElement("div");
  toggle.className = "editor-toggle";
  toggle.innerHTML = `
    <button data-mode="visual" onclick="toggleEditMode('${side}', ${seqIndex}, 'visual')">\ud83d\udcdd Visual</button>
    <button data-mode="hex" class="active" onclick="toggleEditMode('${side}', ${seqIndex}, 'hex')">&lt;&gt; Hex</button>
  `;
  editor.appendChild(toggle);
  sub.appendChild(editor);

  return sub;
}

/**
 * Sequence => Byte-String
 */
function sequenceToString(seq) {
  if (!seq) return "";
  if (seq.identifier === "RAW") {
    return buildByteString(seq.data);
  }
  let hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
  let arr = [
    seq.identifier,
    hl.slice(0, 2),
    hl.slice(2, 4),
    ...seq.data
  ];
  return buildByteString(arr);
}

/**
 * Text => Sequence { identifier, lengthVal, data } or {RAW}
 */
function stringToSequence(text) {
  let arr = parseByteString(text);
  if (arr.length < 1) return null;
  if (arr[0] === "RAW" || arr.length < 3) {
    return { identifier: "RAW", lengthVal: arr.length, data: arr };
  }
  let identifier = arr[0];
  let lenHigh = arr[1];
  let lenLow = arr[2];
  let lengthVal = parseInt(lenHigh + lenLow, 16);
  if (isNaN(lengthVal)) lengthVal = 0;
  let data = arr.slice(3);
  return { identifier, lengthVal, data };
}

/**
 * Re-assembling bytes for a given side
 */
function reAssembleBytes(side) {
  const sd = sideData[side];
  let combined = [];
  for (let seq of sd.sequences) {
    if (!seq) continue;
    if (seq.identifier === "RAW") {
      combined.push(...seq.data);
    } else {
      let hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
      combined.push(seq.identifier, hl.slice(0, 2), hl.slice(2, 4), ...seq.data);
    }
  }

  updateUsageUI(side, combined.length);

  sd.staging1Bytes = combined.slice(0, MAX_STAGING1);
  sd.staging2Bytes = combined.slice(MAX_STAGING1, MAX_STAGING1 + MAX_STAGING2);

  while (sd.staging1Bytes.length < MAX_STAGING1) sd.staging1Bytes.push("00");
  while (sd.staging2Bytes.length < MAX_STAGING2) sd.staging2Bytes.push("00");

  const i1 = document.getElementById(`${side}Staging1`);
  const i2 = document.getElementById(`${side}Staging2`);
  if (i1) i1.value = buildByteString(sd.staging1Bytes);
  if (i2) i2.value = buildByteString(sd.staging2Bytes);
}

/**
 * create ONE p5 instance for every Diagram #i
 */
function createSingleChart(seqIndex, containerDiv) {
  return new p5((sketch) => {
    let maxTime = 0;
    let margin = 40;
    let w = 0;
    let h = 0;

    sketch.setup = () => {
      // Use clientWidth to get full width
      let cw = containerDiv.clientWidth;
      let ch = containerDiv.clientHeight || 250;
      let canvas = sketch.createCanvas(cw, ch);
      canvas.parent(containerDiv);

      w = sketch.width - 2 * margin;
      h = sketch.height - 2 * margin;

      // Only start interaction if clicking directly on the canvas
      canvas.mousePressed(() => {
        isDragging = true;
        handleInteraction();
      });
    };

    sketch.windowResized = () => {
      let cw = containerDiv.clientWidth;
      sketch.resizeCanvas(cw, sketch.height);
      w = sketch.width - 2 * margin;
    };

    sketch.draw = () => {
      sketch.background(255);
      let leftSeq = sideData.left.sequences[seqIndex];
      let rightSeq = sideData.right.sequences[seqIndex];
      let leftData = parseForChart(leftSeq);
      let rightData = parseForChart(rightSeq);

      // Re-calc maxTime every frame just in case seq changed
      maxTime = Math.max(leftData.maxT, rightData.maxT);
      if (maxTime === 0) maxTime = 1000; // default view

      // Border
      sketch.stroke(0);
      sketch.strokeWeight(1);
      sketch.noFill();
      sketch.rect(margin, margin, w, h);

      // Axis
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

      // Define the steps for the X-axis grid
      let gridStep = (maxTime <= 2500) ? 50 : 200;
      let labelStep = maxTime > 2500 ? 1000 : 500;

      // X-axis grid
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
      // Y-axis grid
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

      // Helper to draw a polyline
      const drawLine = (pts, color) => {
        if (!pts || pts.length === 0) return;
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        sketch.beginShape();
        for (let p of pts) {
          let x = sketch.map(p.t, 0, maxTime, margin, margin + w);
          let y = sketch.map(p.b, 0, 100, margin + h, margin);
          sketch.vertex(x, y);
        }
        sketch.endShape();
      };

      // Helper to draw a single segment between two points
      const drawSegment = (p1, p2, color) => {
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        let x1 = sketch.map(p1.t, 0, maxTime, margin, margin + w);
        let y1 = sketch.map(p1.b, 0, 100, margin + h, margin);
        let x2 = sketch.map(p2.t, 0, maxTime, margin, margin + w);
        let y2 = sketch.map(p2.b, 0, 100, margin + h, margin);
        sketch.line(x1, y1, x2, y2);
      };

      if (arePointsIdentical(leftData.points, rightData.points)) {
        drawLine(leftData.points, sketch.color(0, 180, 0)); // Green = identical
      } else {
        const lp = leftData.points;
        const rp = rightData.points;
        const maxPts = Math.max(lp.length, rp.length);

        // Draw segment-by-segment: green where both endpoints match, blue/red where they differ
        for (let s = 0; s < maxPts - 1; s++) {
          const lHas = s + 1 < lp.length;
          const rHas = s + 1 < rp.length;
          const bothMatch = lHas && rHas &&
            lp[s].t === rp[s].t && lp[s].b === rp[s].b &&
            lp[s + 1].t === rp[s + 1].t && lp[s + 1].b === rp[s + 1].b;

          if (bothMatch) {
            drawSegment(lp[s], lp[s + 1], sketch.color(0, 180, 0)); // Green
          } else {
            if (lHas) drawSegment(lp[s], lp[s + 1], sketch.color(0, 0, 255)); // Blue
            if (rHas) drawSegment(rp[s], rp[s + 1], sketch.color(255, 0, 0)); // Red
          }
        }
      }

      // Current Position Indicator
      if (typeof currentAnimTime !== 'undefined') {
        let xPos = sketch.map(currentAnimTime, 0, maxTime, margin, margin + w);

        if (xPos >= margin && xPos <= margin + w) {
          sketch.stroke(50);
          sketch.strokeWeight(2);
          sketch.line(xPos, margin, xPos, margin + h);

          sketch.fill(50);
          sketch.noStroke();
          sketch.triangle(xPos, margin + h, xPos - 5, margin + h + 10, xPos + 5, margin + h + 10);
        }
      }
    };

    let isDragging = false;

    // Helper to handle both click and drag
    const handleInteraction = () => {
      // Check if mouse is inside canvas bounds
      if (sketch.mouseX >= 0 && sketch.mouseX <= sketch.width &&
        sketch.mouseY >= 0 && sketch.mouseY <= sketch.height) {

        // Check if within the graph area (with a little tolerance)
        if (sketch.mouseX >= margin && sketch.mouseX <= margin + w) {
          let clickedTime = sketch.map(sketch.mouseX, margin, margin + w, 0, maxTime);
          // Clamp
          if (clickedTime < 0) clickedTime = 0;
          if (clickedTime > maxTime) clickedTime = maxTime;

          // Seek
          seekAnimation(clickedTime);

          // Highlight Lights
          const leftLight = document.getElementById(`left_light_${seqIndex}`);
          const rightLight = document.getElementById(`right_light_${seqIndex}`);
          if (leftLight) leftLight.classList.add('focused');
          if (rightLight) rightLight.classList.add('focused');

          return false;
        }
      }
    };

    const clearInteraction = () => {
      const leftLight = document.getElementById(`left_light_${seqIndex}`);
      const rightLight = document.getElementById(`right_light_${seqIndex}`);
      if (leftLight) leftLight.classList.remove('focused');
      if (rightLight) rightLight.classList.remove('focused');
    };

    // DRAG INTERACTION - Only continue if we started on this canvas
    sketch.mouseDragged = () => {
      if (isDragging) {
        handleInteraction();
      }
    };

    // RELEASE INTERACTION
    sketch.mouseReleased = () => {
      if (isDragging) {
        isDragging = false;
        clearInteraction();
      }
    };

  });
}

/**
 * parseForChart(seq): Sum up Duration => Time, Brightness => {maxT, points[]}
 */
function parseForChart(seq) {
  if (!seq || seq.identifier === "RAW") {
    return { maxT: 0, points: [] };
  }
  let sumT = 0;
  let pts = [];

  // Start with 0ms and 0%
  pts.push({ t: 0, b: 0 });

  // Process the data pairs: First Byte pair creates the first datapoint
  for (let i = 0; i < seq.data.length; i += 2) {
    let durHex = parseInt(seq.data[i], 16) || 0;
    let briHex = parseInt(seq.data[i + 1], 16) || 0;
    sumT += durHex * 10; // Duration in ms (Byte-Value * 10)
    let bri = Math.min(briHex, 100); // Brigthness (0-100%)
    pts.push({ t: sumT, b: bri });
  }

  return { maxT: sumT, points: pts };
}

/**
 * Compare two arrays of {t, b} chart points for equality
 */
function arePointsIdentical(leftPoints, rightPoints) {
  if (leftPoints.length !== rightPoints.length) return false;
  for (let i = 0; i < leftPoints.length; i++) {
    if (leftPoints[i].t !== rightPoints[i].t || leftPoints[i].b !== rightPoints[i].b) return false;
  }
  return true;
}

// ============================================================================
// 3) Update diagram for a given sequence index
// ============================================================================
function updateSingleDiagram(seqIndex) {
  let s = chartSketches[seqIndex];
  if (s) s.remove();

  // Create new
  let chartDiv = document.getElementById(`chartCanvas_${seqIndex}`);
  chartSketches[seqIndex] = createSingleChart(seqIndex, chartDiv);
}

// ============================================================================
// Animation Player Logic
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
      if (channel.type === "path") {
        el = document.createElementNS("http://www.w3.org/2000/svg", "path");
        el.setAttribute("d", channel.d);
      } else if (channel.type === "circle") {
        el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        el.setAttribute("cx", channel.cx);
        el.setAttribute("cy", channel.cy);
        el.setAttribute("r", channel.r);
      }
      if (el) {
        el.id = `${side}_light_${idx}`;
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
    t += durHex * 10;
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

function updateVisuals(time) {
  for (const side of ['left', 'right']) {
    sideData[side].sequences.forEach((seq, idx) => {
      const el = document.getElementById(`${side}_light_${idx}`);
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
    let stepDur = durHex * 10;
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

// Initialize on load
window.onload = () => {
  initVehicles();
  loadSelectedTemplate();
  buildDynamicFields(); // Ensure initialization even if no template is selected
};
