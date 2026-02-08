// ============================================================================
// Editor: Sequence editors and rendering
// ============================================================================

// Edit mode state: 'hex' or 'visual' per sequence
let editModes = { left: {}, right: {} };

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
