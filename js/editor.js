const editModes = { left: {}, right: {} };

function toggleEditMode(side, seqIndex, mode) {
  editModes[side][seqIndex] = mode;
  renderSequenceEditor(side, seqIndex);
}

function renderSequenceEditor(side, seqIndex) {
  const container = document.getElementById(`editor_${side}_${seqIndex}`);
  if (!container) return;

  const mode = editModes[side][seqIndex] || 'hex';
  const seq = sideData[side].sequences[seqIndex];

  const toggleDiv = container.querySelector('.editor-toggle');
  if (toggleDiv) {
    toggleDiv.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

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
  const textarea = document.createElement('textarea');
  textarea.value = seq ? sequenceToString(seq) : '';
  textarea.className = 'hex-editor';
  textarea.oninput = (e) => {
    sideData[side].sequences[seqIndex] = stringToSequence(e.target.value);
    applySequenceEdit(side, seqIndex);
    updateSeqLabels(seqIndex);
  };
  container.appendChild(textarea);
}

function renderVisualEditor(container, side, seqIndex, seq) {
  container.innerHTML = '';

  if (!seq || seq.identifier === RAW_IDENTIFIER) {
    container.innerHTML = '<p style="color:#999;font-size:12px;">RAW data - use hex mode to edit</p>';
    return;
  }

  const editorDiv = document.createElement('div');
  editorDiv.className = 'visual-editor';

  // Parse hex data into step objects
  const steps = [];
  for (let i = 0; i < seq.data.length; i += 2) {
    const durHex = parseInt(seq.data[i], 16) || 0;
    const briHex = parseInt(seq.data[i + 1], 16) || 0;
    steps.push({ duration: durHex, brightness: Math.min(briHex, 100) });
  }

  // Build step rows with duration/brightness controls
  steps.forEach((step, stepIdx) => {
    const row = document.createElement('div');
    row.className = 'step-row';

    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = `#${stepIdx + 1}`;
    row.appendChild(label);

    const durField = document.createElement('div');
    durField.className = 'step-field';
    durField.innerHTML = `
      <label>Duration:</label>
      <input type="range" min="0" max="255" value="${step.duration}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="duration">
      <input type="number" min="0" max="5100" step="20" value="${step.duration * 20}"
             data-side="${side}" data-seq="${seqIndex}" data-step="${stepIdx}" data-type="duration">
      <span class="value-display">ms</span>
    `;
    row.appendChild(durField);

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

    const removeBtn = document.createElement('button');
    removeBtn.className = 'step-remove';
    removeBtn.textContent = '\u2715';
    removeBtn.onclick = () => removeStep(side, seqIndex, stepIdx);
    row.appendChild(removeBtn);

    editorDiv.appendChild(row);
  });

  // Wire up slider input handlers
  editorDiv.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.oninput = (e) => {
      const { side: targetSide, seq: seqIdx, step: stepIdx, type } = e.target.dataset;
      const val = parseInt(e.target.value);

      const numInput = e.target.nextElementSibling;
      if (type === 'duration') {
        // Real-world validation: x20 multiplier confirmed (BMW G20 2020)
        numInput.value = val * 20;
      } else {
        numInput.value = val;
      }

      updateStepValue(targetSide, parseInt(seqIdx), parseInt(stepIdx), type, val);
    };
  });

  // Wire up number input handlers
  editorDiv.querySelectorAll('input[type="number"]').forEach(numInput => {
    numInput.oninput = (e) => {
      const { side: targetSide, seq: seqIdx, step: stepIdx, type } = e.target.dataset;
      let inputVal = parseInt(e.target.value) || 0;

      let val;
      if (type === 'duration') {
        // Real-world validation: x20 multiplier confirmed (BMW G20 2020)
        inputVal = Math.max(0, Math.min(5100, inputVal));
        val = Math.round(inputVal / 20);
      } else {
        val = Math.max(0, Math.min(100, inputVal));
      }

      const slider = e.target.previousElementSibling;
      slider.value = val;

      updateStepValue(targetSide, parseInt(seqIdx), parseInt(stepIdx), type, val);
    };
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-step-btn';
  addBtn.textContent = '+ Add Step';
  addBtn.onclick = () => addStep(side, seqIndex);
  editorDiv.appendChild(addBtn);

  container.appendChild(editorDiv);
}

function applySequenceEdit(side, seqIndex) {
  reAssembleBytes(side);
  onDataEdited();
  updateSingleDiagram(seqIndex);
  updateVisuals(currentAnimTime);
}

function copySequence(fromSide, seqIndex) {
  const toSide = fromSide === 'left' ? 'right' : 'left';
  const fromSeq = sideData[fromSide].sequences[seqIndex];

  if (!fromSeq) return;

  sideData[toSide].sequences[seqIndex] = {
    identifier: fromSeq.identifier,
    lengthVal: fromSeq.lengthVal,
    data: [...fromSeq.data]
  };

  applySequenceEdit(toSide, seqIndex);
  renderSequenceEditor(toSide, seqIndex);
}

function updateStepValue(side, seqIndex, stepIndex, type, value) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === RAW_IDENTIFIER) return;

  const dataIdx = stepIndex * 2 + (type === 'duration' ? 0 : 1);
  if (dataIdx < seq.data.length) {
    seq.data[dataIdx] = value.toString(16).toUpperCase().padStart(2, '0');

    seq.lengthVal = Math.floor(seq.data.length / 2);

    applySequenceEdit(side, seqIndex);
  }
}

function addStep(side, seqIndex) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === RAW_IDENTIFIER) return;

  seq.data.push('0A', '00');
  seq.lengthVal = Math.floor(seq.data.length / 2);

  applySequenceEdit(side, seqIndex);
  renderSequenceEditor(side, seqIndex);
}

function removeStep(side, seqIndex, stepIndex) {
  const seq = sideData[side].sequences[seqIndex];
  if (!seq || seq.identifier === RAW_IDENTIFIER) return;

  const dataIdx = stepIndex * 2;
  if (dataIdx < seq.data.length) {
    seq.data.splice(dataIdx, 2);
    seq.lengthVal = Math.floor(seq.data.length / 2);

    applySequenceEdit(side, seqIndex);
    renderSequenceEditor(side, seqIndex);
  }
}

function getChannelPhaseName(seqIndex) {
  if (!currentPhaseTimeline) return null;
  const seq = sideData.left.sequences[seqIndex] || sideData.right.sequences[seqIndex];
  if (!seq || seq.identifier === RAW_IDENTIFIER) return null;
  const chId = parseInt(seq.identifier, 16);
  const phaseIdx = currentPhaseTimeline.channelPhaseMap[chId];
  if (phaseIdx === undefined) return null;
  return currentPhaseTimeline.phases[phaseIdx].name;
}

function renderPhaseTimingSummary(container) {
  if (!currentPhaseTimeline) return;

  const bar = document.createElement("div");
  bar.className = "phase-timing-bar";

  const parts = [];
  for (let i = 0; i < currentPhaseTimeline.phases.length; i++) {
    const phase = currentPhaseTimeline.phases[i];
    const chList = phase.channels.join(', ');
    parts.push(`${phase.name}: ${phase.start}-${phase.end}ms (Ch ${chList})`);

    // Check for gap between this phase and next
    if (i + 1 < currentPhaseTimeline.phases.length) {
      const nextPhase = currentPhaseTimeline.phases[i + 1];
      if (nextPhase.start > phase.end) {
        parts.push(`Gap: ${phase.end}-${nextPhase.start}ms`);
      }
    }
  }

  bar.textContent = parts.join(' | ');
  container.appendChild(bar);
}

function renderDynamicSequences() {
  const container = document.getElementById("dynamicContainer");

  // Clean up existing chart instances
  chartSketches.forEach(s => { if (s && s.remove) s.remove(); });
  chartSketches = [];
  cleanupSummaryCharts();

  const playerDiv = document.getElementById("animationPlayer");
  const controlsDiv = playerDiv.querySelector(".controls");

  // Set up sticky player toggle (once)
  if (!document.getElementById("stickyToggle")) {
    const stickyLabel = document.createElement("label");
    stickyLabel.className = "sticky-toggle-label";

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

  // Rebuild dynamic content
  container.innerHTML = "";

  renderPhaseTimingSummary(container);

  const vehicleKey = document.getElementById("vehicleSelect") ? document.getElementById("vehicleSelect").value : null;
  const config = vehicleKey ? VEHICLE_CONFIGS[vehicleKey] : null;
  // Build summary charts for physical lights
  if (currentPhaseTimeline && config) {
    const physicalIds = getPhysicalLightIds(config);
    if (physicalIds.length > 0) {
      const summarySection = document.createElement("div");
      summarySection.className = "summary-charts-section";
      const summaryHeader = document.createElement("h3");
      summaryHeader.textContent = "Physical Light Summary";
      summaryHeader.className = "summary-header";
      summarySection.appendChild(summaryHeader);

      for (const phId of physicalIds) {
        const ch = config.channels.find(c => c.id === phId);
        const label = ch ? ch.label : `Channel ${phId}`;

        const chartWrapper = document.createElement("div");
        chartWrapper.className = "seq-block";

        const chartDiv = document.createElement("div");
        chartDiv.id = `summaryChart_ch${phId}`;
        chartDiv.className = "chartCanvas";
        const labelSpan = document.createElement("span");
        labelSpan.className = "diagram-label";
        const contributingChs = [phId];
        for (const ch of config.channels) {
          if (ch.physicalLight === phId) contributingChs.push(ch.id);
        }
        const chListStr = contributingChs.map(id => `Ch ${id}`).join(' + ');
        labelSpan.textContent = `${label} — Resolved Timeline (${chListStr})`;
        chartDiv.appendChild(labelSpan);
        chartWrapper.appendChild(chartDiv);
        summarySection.appendChild(chartWrapper);

        setTimeout(() => {
          summaryChartSketches.push(createSummaryChart(phId, chartDiv, config));
        }, 0);
      }

      container.appendChild(summarySection);
    }
  }

  // Build per-sequence editor blocks with charts
  const maxSeq = Math.max(sideData.left.sequences.length, sideData.right.sequences.length);

  for (let i = 0; i < maxSeq; i++) {
    const seqBlock = document.createElement("div");
    seqBlock.className = "seq-block";

    seqBlock.appendChild(createSeqSubblock('left', i));
    seqBlock.appendChild(createSeqSubblock('right', i));

    const chartDiv = document.createElement("div");
    chartDiv.id = `chartCanvas_${i}`;
    chartDiv.className = "chartCanvas";
    chartDiv.style.height = "250px";
    const labelSpan = document.createElement('span');
    labelSpan.className = 'diagram-label';
    labelSpan.textContent = getDiagramLabel(i);
    chartDiv.appendChild(labelSpan);
    seqBlock.appendChild(chartDiv);

    container.appendChild(seqBlock);

    editModes.left[i] = editModes.left[i] || 'hex';
    editModes.right[i] = editModes.right[i] || 'hex';
    renderSequenceEditor('left', i);
    renderSequenceEditor('right', i);

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
  if (seq.identifier === RAW_IDENTIFIER) return `RAW ${label}`;
  const chNum = parseInt(seq.identifier, 16);
  const chName = getChannelName(chNum);
  const phaseName = getChannelPhaseName(seqIndex);
  const phaseSuffix = phaseName ? ` [${phaseName}]` : '';
  if (chName) return `${chName} — ${label} (Ch ${chNum})${phaseSuffix}`;
  return `Ch ${label} ${chNum} (0x${seq.identifier.toUpperCase()})${phaseSuffix}`;
}

function getDiagramLabel(seqIndex) {
  const leftSeq = sideData.left.sequences[seqIndex];
  const rightSeq = sideData.right.sequences[seqIndex];
  const leftId = leftSeq && leftSeq.identifier !== RAW_IDENTIFIER ? leftSeq.identifier : null;
  const rightId = rightSeq && rightSeq.identifier !== RAW_IDENTIFIER ? rightSeq.identifier : null;
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

function getChannelCapWarning(seqIndex) {
  if (!currentPhaseTimeline) return null;
  const seq = sideData.left.sequences[seqIndex] || sideData.right.sequences[seqIndex];
  if (!seq || seq.identifier === RAW_IDENTIFIER) return null;
  const chId = parseInt(seq.identifier, 16);
  const phaseIdx = currentPhaseTimeline.channelPhaseMap[chId];
  if (phaseIdx === undefined) return null;
  const phase = currentPhaseTimeline.phases[phaseIdx];
  if (phase.maxDuration === null) return null;
  for (const side of ['left', 'right']) {
    const sideSeq = sideData[side].sequences[seqIndex];
    if (sideSeq && getSequenceDuration(sideSeq) > phase.maxDuration) {
      return phase.maxDuration;
    }
  }
  return null;
}

function createSeqSubblock(side, seqIndex) {
  const isLeft = (side === 'left');
  const label = isLeft ? 'Left' : 'Right';
  const otherSide = isLeft ? 'Right' : 'Left';
  const arrow = isLeft ? '\u2192' : '\u2190';
  const copyTitle = `Copy ${label} \u2192 ${otherSide}`;

  const sub = document.createElement("div");
  sub.className = isLeft ? "seq-subblock" : "seq-subblock seq-subblock-right";

  // Header with label and copy button
  const h4 = document.createElement("h4");
  const seqLabel = getSeqLabel(side, seqIndex);
  h4.innerHTML = `<span data-label-side="${side}" data-label-seq="${seqIndex}">${seqLabel}</span> <button class="mini-copy-btn" onclick="copySequence('${side}', ${seqIndex})" title="${copyTitle}">${arrow}</button>`;

  const capMs = getChannelCapWarning(seqIndex);
  if (capMs !== null) {
    const warn = document.createElement('span');
    warn.className = 'cap-warning';
    warn.textContent = `Content exceeds ${capMs}ms cap`;
    warn.title = `Phase hard cap: animation cuts off at ${capMs}ms`;
    h4.appendChild(warn);
  }

  sub.appendChild(h4);

  // Editor container with hex/visual mode toggle
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
