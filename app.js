// ============================================================================
// Global const and helper functions
// ============================================================================
const MAX_LEFT1 = 252;
const MAX_LEFT2 = 168;
const MAX_RIGHT1 = 252;
const MAX_RIGHT2 = 168;

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
  const isLeft = (side === 'left');
  const max1 = isLeft ? MAX_LEFT1 : MAX_RIGHT1;
  const max2 = isLeft ? MAX_LEFT2 : MAX_RIGHT2;
  const totalMax = max1 + max2;
  const overMax = totalLen > totalMax;

  const c1 = document.getElementById(`counter_${side}Staging1`);
  const c2 = document.getElementById(`counter_${side}Staging2`);
  const l1 = document.getElementById(`label_${side}Staging1`);
  const l2 = document.getElementById(`label_${side}Staging2`);
  const i1 = document.getElementById(`${side}Staging1`);
  const i2 = document.getElementById(`${side}Staging2`);

  if (c1) c1.textContent = `(${Math.min(totalLen, max1)} / ${max1} Bytes)`;
  if (c2) c2.textContent = `(${Math.max(0, Math.min(totalLen - max1, max2))} / ${max2} Bytes)`;

  if (overMax) {
    if (l1) l1.classList.add("overflow-error");
    if (l2) l2.classList.add("overflow-error");
    if (i1) i1.classList.add("overflow-error");
    if (i2) i2.classList.add("overflow-error");
  } else {
    if (l1) l1.classList.remove("overflow-error");
    if (l2) l2.classList.remove("overflow-error");
    if (i1) i1.classList.remove("overflow-error");
    if (i2) i2.classList.remove("overflow-error");
  }
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
  // Leert alle vier Hauptfelder
  document.getElementById("leftStaging1").value = "";
  document.getElementById("leftStaging2").value = "";
  document.getElementById("rightStaging1").value = "";
  document.getElementById("rightStaging2").value = "";
}

// ============================================================================
// 1) Main storage of Bytes and sequences
// ============================================================================
let left1Bytes = [], left2Bytes = [], right1Bytes = [], right2Bytes = [];
let sequencesLeft = [], sequencesRight = [];

let chartSketchesLeft = [];
let chartSketchesRight = [];

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
  const seq = (side === 'left') ? sequencesLeft[seqIndex] : sequencesRight[seqIndex];

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
    if (side === 'left') {
      sequencesLeft[seqIndex] = stringToSequence(e.target.value);
      reAssembleLeftBytes();
    } else {
      sequencesRight[seqIndex] = stringToSequence(e.target.value);
      reAssembleRightBytes();
    }
    updateSingleDiagram(side, seqIndex);
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
    removeBtn.textContent = '✕';
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
  const fromSeq = fromSide === 'left' ? sequencesLeft[seqIndex] : sequencesRight[seqIndex];

  if (!fromSeq) return;

  // Deep copy the sequence
  const copiedSeq = {
    identifier: fromSeq.identifier,
    lengthVal: fromSeq.lengthVal,
    data: [...fromSeq.data]
  };

  // Assign to target side
  if (toSide === 'left') {
    sequencesLeft[seqIndex] = copiedSeq;
    reAssembleLeftBytes();
  } else {
    sequencesRight[seqIndex] = copiedSeq;
    reAssembleRightBytes();
  }

  // Re-render the target editor and update diagram
  renderSequenceEditor(toSide, seqIndex);
  updateSingleDiagram(toSide, seqIndex);
  updateVisuals(currentAnimTime);
}

function updateStepValue(side, seqIndex, stepIndex, type, value) {
  const seq = (side === 'left') ? sequencesLeft[seqIndex] : sequencesRight[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  const dataIdx = stepIndex * 2 + (type === 'duration' ? 0 : 1);
  if (dataIdx < seq.data.length) {
    seq.data[dataIdx] = value.toString(16).toUpperCase().padStart(2, '0');

    // Recalculate length if needed (lengthVal = number of step pairs)
    seq.lengthVal = Math.floor(seq.data.length / 2);

    if (side === 'left') {
      reAssembleLeftBytes();
    } else {
      reAssembleRightBytes();
    }
    updateSingleDiagram(side, seqIndex);
    updateVisuals(currentAnimTime);
  }
}

function addStep(side, seqIndex) {
  const seq = (side === 'left') ? sequencesLeft[seqIndex] : sequencesRight[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  // Add default step: 10 (100ms), 00 (0%)
  seq.data.push('0A', '00');
  seq.lengthVal = Math.floor(seq.data.length / 2);

  if (side === 'left') {
    reAssembleLeftBytes();
  } else {
    reAssembleRightBytes();
  }
  updateSingleDiagram(side, seqIndex);
  updateVisuals(currentAnimTime);
  renderSequenceEditor(side, seqIndex);
}

function removeStep(side, seqIndex, stepIndex) {
  const seq = (side === 'left') ? sequencesLeft[seqIndex] : sequencesRight[seqIndex];
  if (!seq || seq.identifier === 'RAW') return;

  // Remove 2 bytes for this step
  const dataIdx = stepIndex * 2;
  if (dataIdx < seq.data.length) {
    seq.data.splice(dataIdx, 2);
    seq.lengthVal = Math.floor(seq.data.length / 2);

    if (side === 'left') {
      reAssembleLeftBytes();
    } else {
      reAssembleRightBytes();
    }
    updateSingleDiagram(side, seqIndex);
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
  // 1) Read the main input fields
  const leftStaging1 = document.getElementById("leftStaging1").value;
  const leftStaging2 = document.getElementById("leftStaging2").value;
  const rightStaging1 = document.getElementById("rightStaging1").value;
  const rightStaging2 = document.getElementById("rightStaging2").value;

  // 2) Parse in Byte-Arrays
  left1Bytes = parseByteString(leftStaging1);
  left2Bytes = parseByteString(leftStaging2);
  right1Bytes = parseByteString(rightStaging1);
  right2Bytes = parseByteString(rightStaging2);

  // 3) Check length
  ensureMaxSize(left1Bytes, MAX_LEFT1);
  ensureMaxSize(left2Bytes, MAX_LEFT2);
  ensureMaxSize(right1Bytes, MAX_RIGHT1);
  ensureMaxSize(right2Bytes, MAX_RIGHT2);

  // 4) Extract sequences
  sequencesLeft = parseAllSequencesFromBytes(left1Bytes, left2Bytes);
  sequencesRight = parseAllSequencesFromBytes(right1Bytes, right2Bytes);

  // 5) Update UI counters (excluding padding)
  updateUsageUI('left', calculateSeqsSize(sequencesLeft));
  updateUsageUI('right', calculateSeqsSize(sequencesRight));

  // 6) Create dynamic fields
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
  chartSketchesLeft.forEach(s => { if (s && s.remove) s.remove(); });
  chartSketchesLeft = [];
  chartSketchesRight = [];

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
        // Optional: Move up in DOM to ensure it sticks relative to body if needed?
        // Actually sticky works within flow. We just need to make sure
        // no parent has overflow: hidden. Body is flex col so it should be fine.

        // One tweak: when sticky, we might want a bit of top margin/padding adjustment
        // so it doesn't overlap weirdly. But CSS box-shadow helps.
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
  let maxSeq = Math.max(sequencesLeft.length, sequencesRight.length);

  for (let i = 0; i < maxSeq; i++) {
    const leftSeq = sequencesLeft[i];
    const rightSeq = sequencesRight[i];

    const seqBlock = document.createElement("div");
    seqBlock.className = "seq-block";

    // left Subblock
    const leftSub = document.createElement("div");
    leftSub.className = "seq-subblock";
    let leftH4 = document.createElement("h4");
    leftH4.style.display = "flex";
    leftH4.style.justifyContent = "space-between";
    leftH4.style.alignItems = "center";
    leftH4.innerHTML = `<span>Seq Left #${i + 1}</span> <button class="mini-copy-btn" onclick="copySequence('left', ${i})" title="Copy Left → Right">→</button>`;
    leftSub.appendChild(leftH4);

    // Editor container with toggle
    const leftEditor = document.createElement("div");
    leftEditor.id = `editor_left_${i}`;

    // Toggle buttons
    const leftToggle = document.createElement("div");
    leftToggle.className = "editor-toggle";
    leftToggle.innerHTML = `
      <button data-mode="visual" onclick="toggleEditMode('left', ${i}, 'visual')">📝 Visual</button>
      <button data-mode="hex" class="active" onclick="toggleEditMode('left', ${i}, 'hex')">&lt;&gt; Hex</button>
    `;
    leftEditor.appendChild(leftToggle);
    leftSub.appendChild(leftEditor);

    seqBlock.appendChild(leftSub);

    // right Subblock
    const rightSub = document.createElement("div");
    rightSub.className = "seq-subblock";
    let rightH4 = document.createElement("h4");
    rightH4.style.display = "flex";
    rightH4.style.justifyContent = "space-between";
    rightH4.style.alignItems = "center";
    rightH4.style.flexDirection = "row-reverse"; // Arrow on the left for right side
    rightH4.innerHTML = `<span>Seq Right #${i + 1}</span> <button class="mini-copy-btn" onclick="copySequence('right', ${i})" title="Copy Right → Left">←</button>`;
    rightSub.appendChild(rightH4);

    // Editor container with toggle
    const rightEditor = document.createElement("div");
    rightEditor.id = `editor_right_${i}`;

    // Toggle buttons
    const rightToggle = document.createElement("div");
    rightToggle.className = "editor-toggle";
    rightToggle.innerHTML = `
      <button data-mode="visual" onclick="toggleEditMode('right', ${i}, 'visual')">📝 Visual</button>
      <button data-mode="hex" class="active" onclick="toggleEditMode('right', ${i}, 'hex')">&lt;&gt; Hex</button>
    `;
    rightEditor.appendChild(rightToggle);
    rightSub.appendChild(rightEditor);

    seqBlock.appendChild(rightSub);

    let chartDiv = document.createElement("div");
    chartDiv.id = `chartCanvas_${i}`;
    chartDiv.className = "chartCanvas";
    // REMOVED fixed width/height inline styles to let CSS control it
    // But p5 needs a size. We can get it from clientWidth.
    // We'll set a default minimum height.
    chartDiv.style.height = "250px";
    chartDiv.textContent = `Diagram Sequence #${i + 1}`;
    seqBlock.appendChild(chartDiv);

    container.appendChild(seqBlock);

    // Initialize editors with default mode (hex)
    editModes.left[i] = editModes.left[i] || 'hex';
    editModes.right[i] = editModes.right[i] || 'hex';
    renderSequenceEditor('left', i);
    renderSequenceEditor('right', i);

    // Initial p5 Sketch
    let s = createSingleChart(i, chartDiv);
    chartSketchesLeft[i] = s;
    chartSketchesRight[i] = s;
  }
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
 * Re-assembling => left1Bytes + left2Bytes
 */
function reAssembleLeftBytes() {
  let combined = [];
  for (let seq of sequencesLeft) {
    if (!seq) continue;
    if (seq.identifier === "RAW") {
      combined.push(...seq.data);
    } else {
      let hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
      combined.push(seq.identifier, hl.slice(0, 2), hl.slice(2, 4), ...seq.data);
    }
  }

  const totalLen = combined.length;
  updateUsageUI('left', totalLen);

  left1Bytes = combined.slice(0, MAX_LEFT1);
  let leftover = combined.slice(MAX_LEFT1);
  left2Bytes = leftover.slice(0, MAX_LEFT2);

  while (left1Bytes.length < MAX_LEFT1) left1Bytes.push("00");
  while (left2Bytes.length < MAX_LEFT2) left2Bytes.push("00");

  const i1 = document.getElementById("leftStaging1");
  const i2 = document.getElementById("leftStaging2");
  if (i1) i1.value = buildByteString(left1Bytes);
  if (i2) i2.value = buildByteString(left2Bytes);
}

/**
 * Re-assembling => right1Bytes + right2Bytes
 */
function reAssembleRightBytes() {
  let combined = [];
  for (let seq of sequencesRight) {
    if (!seq) continue;
    if (seq.identifier === "RAW") {
      combined.push(...seq.data);
    } else {
      let hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
      combined.push(seq.identifier, hl.slice(0, 2), hl.slice(2, 4), ...seq.data);
    }
  }

  const totalLen = combined.length;
  updateUsageUI('right', totalLen);

  right1Bytes = combined.slice(0, MAX_RIGHT1);
  let leftover = combined.slice(MAX_RIGHT1);
  right2Bytes = leftover.slice(0, MAX_RIGHT2);

  while (right1Bytes.length < MAX_RIGHT1) right1Bytes.push("00");
  while (right2Bytes.length < MAX_RIGHT2) right2Bytes.push("00");

  const i1 = document.getElementById("rightStaging1");
  const i2 = document.getElementById("rightStaging2");
  if (i1) i1.value = buildByteString(right1Bytes);
  if (i2) i2.value = buildByteString(right2Bytes);
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
      // Optional: handle resize logic if needed.
      // Re-measure container and resize canvas.
      let cw = containerDiv.clientWidth;
      sketch.resizeCanvas(cw, sketch.height);
      w = sketch.width - 2 * margin;
    };

    sketch.draw = () => {
      sketch.background(255);
      let leftSeq = sequencesLeft[seqIndex];
      let rightSeq = sequencesRight[seqIndex];
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

      // Helper to draw lines
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

      drawLine(leftData.points, sketch.color(0, 0, 255)); // Blue
      drawLine(rightData.points, sketch.color(255, 0, 0)); // Red

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

// ============================================================================
// 3) Update-Button => updateSingleDiagram("left"/"right", i)
// ============================================================================
function updateSingleDiagram(side, seqIndex) {

  let s = (side === "left") ? chartSketchesLeft[seqIndex] : chartSketchesRight[seqIndex];
  if (s) s.remove();

  // Create new
  let chartDiv = document.getElementById(`chartCanvas_${seqIndex}`);
  let newSketch = createSingleChart(seqIndex, chartDiv);

  // Save
  chartSketchesLeft[seqIndex] = newSketch;
  chartSketchesRight[seqIndex] = newSketch;
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
  [...sequencesLeft, ...sequencesRight].forEach(seq => {
    const dur = getSequenceDuration(seq);
    if (dur > totalDuration) totalDuration = dur;
  });

  const slider = document.getElementById("seekSlider");
  slider.max = totalDuration;
  slider.value = 0;
  document.getElementById("totalTimeDisplay").textContent = `${totalDuration} ms`;

  stopAnimation();
}

function setupGridVisualization(leftContainer, rightContainer) {
  // Create lights for Left
  sequencesLeft.forEach((seq, idx) => {
    const div = document.createElement("div");
    div.className = "light-bulb";
    div.dataset.index = idx + 1;
    div.id = `left_light_${idx}`;
    leftContainer.appendChild(div);
  });

  // Create lights for Right
  sequencesRight.forEach((seq, idx) => {
    const div = document.createElement("div");
    div.className = "light-bulb";
    div.dataset.index = idx + 1;
    div.id = `right_light_${idx}`;
    rightContainer.appendChild(div);
  });
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
    // If playing, update time logic needs a reset of lastFrameTime
    // so we don't jump. But actually we use Delta, so we just
    // set currentAnimTime and ensure lastFrameTime is 'now' to avoid huge delta
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
  // Update Left
  sequencesLeft.forEach((seq, idx) => {
    const el = document.getElementById(`left_light_${idx}`);
    if (el) {
      const bri = getBrightnessAtTime(seq, time);
      applyBrightness(el, bri);
    }
  });

  // Update Right
  sequencesRight.forEach((seq, idx) => {
    const el = document.getElementById(`right_light_${idx}`);
    if (el) {
      const bri = getBrightnessAtTime(seq, time);
      applyBrightness(el, bri);
    }
  });
}

function applyBrightness(element, brightness) {
  const isSVG = element instanceof SVGElement;
  const val = Math.round((brightness / 100) * 255);

  if (isSVG) {
    // SVG styling
    if (brightness > 0) {
      const color = `rgba(255, 255, 255, ${brightness / 100})`;
      element.setAttribute("fill", color);
      // Only set stroke if it's not focused, or handle focused in CSS with !important
      element.setAttribute("stroke", color);

      // Only apply standard drop-shadow if not focused
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
