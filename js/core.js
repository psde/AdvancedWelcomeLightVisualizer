const MAX_STAGING1 = 252;
const MAX_STAGING2 = 168;
const RAW_IDENTIFIER = "RAW";

const sideData = {
  left:  { staging1Bytes: [], staging2Bytes: [], sequences: [] },
  right: { staging1Bytes: [], staging2Bytes: [], sequences: [] }
};

function parseByteString(str) {
  if (!str) return [];
  const arr = str.replace(/\s/g, "").split(",");
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

function calculateSeqsSize(seqs) {
  let total = 0;
  for (const seq of seqs) {
    if (seq.identifier === RAW_IDENTIFIER) {
      total += seq.data.length;
    } else {
      total += 3 + seq.data.length;
    }
  }
  return total;
}

function parseAllSequencesFromBytes(arr1, arr2) {
  const combined = arr1.concat(arr2);
  let idx = 0;
  const seqs = [];

  while (idx + 3 <= combined.length) {
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
    const endPos = idx + dataByteCount;
    if (endPos > combined.length) {
      console.warn("Sequence data incomplete, break.");
      break;
    }
    const data = combined.slice(idx, endPos);
    idx = endPos;

    seqs.push({ identifier, lengthVal, data });
  }

  // Collect unparsed trailing bytes as RAW
  const leftover = combined.slice(idx);
  const hasContent = leftover.some(b => b !== "00" && b !== "0");
  if (hasContent) {
    seqs.push({ identifier: RAW_IDENTIFIER, lengthVal: leftover.length, data: leftover });
  }
  return seqs;
}

function sequenceToString(seq) {
  if (!seq) return "";
  if (seq.identifier === RAW_IDENTIFIER) {
    return buildByteString(seq.data);
  }
  const hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
  const arr = [
    seq.identifier,
    hl.slice(0, 2),
    hl.slice(2, 4),
    ...seq.data
  ];
  return buildByteString(arr);
}

function stringToSequence(text) {
  const arr = parseByteString(text);
  if (arr.length < 1) return null;
  if (arr[0] === RAW_IDENTIFIER || arr.length < 3) {
    return { identifier: RAW_IDENTIFIER, lengthVal: arr.length, data: arr };
  }
  const identifier = arr[0];
  const lenHigh = arr[1];
  const lenLow = arr[2];
  let lengthVal = parseInt(lenHigh + lenLow, 16);
  if (isNaN(lengthVal)) lengthVal = 0;
  const data = arr.slice(3);
  return { identifier, lengthVal, data };
}

function getSequenceDuration(seq) {
  if (!seq || seq.identifier === RAW_IDENTIFIER) return 0;
  let totalTime = 0;
  for (let i = 0; i < seq.data.length; i += 2) {
    const durationHex = parseInt(seq.data[i], 16) || 0;
    totalTime += durationHex * 20;
  }
  return totalTime;
}

function computePhaseTimeline(vehicleConfig, sides) {
  if (!vehicleConfig || !vehicleConfig.phases) return null;

  const phases = vehicleConfig.phases;
  const channelPhaseMap = {};
  const computedPhases = [];

  let prevEnd = 0;

  // Process each phase: map channels, compute durations, resolve timing
  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi];

    for (const chId of phase.channels) {
      channelPhaseMap[chId] = pi;
    }

    let maxChannelDur = 0;
    for (const chId of phase.channels) {
      const chHex = chId.toString(16).padStart(2, "0").toUpperCase();
      for (const side of ['left', 'right']) {
        const seqs = sides[side] || [];
        for (const seq of seqs) {
          if (seq && seq.identifier && seq.identifier.toUpperCase() === chHex) {
            const dur = getSequenceDuration(seq);
            if (dur > maxChannelDur) maxChannelDur = dur;
          }
        }
      }
    }

    if (phase.maxDuration !== null && phase.maxDuration !== undefined) {
      maxChannelDur = Math.min(maxChannelDur, phase.maxDuration);
    }

    // Resolve phase start time with optional anchor
    const start = (phase.anchor !== undefined && phase.anchor !== null)
      ? Math.max(prevEnd, phase.anchor)
      : prevEnd;
    const end = start + maxChannelDur;

    computedPhases.push({
      name: phase.name,
      channels: phase.channels,
      start: start,
      end: end,
      maxDuration: phase.maxDuration !== undefined ? phase.maxDuration : null
    });

    prevEnd = end;
  }

  return {
    phases: computedPhases,
    totalDuration: prevEnd,
    channelPhaseMap: channelPhaseMap
  };
}

function reAssembleBytes(side) {
  const entry = sideData[side];
  const combined = [];
  for (const seq of entry.sequences) {
    if (!seq) continue;
    if (seq.identifier === RAW_IDENTIFIER) {
      combined.push(...seq.data);
    } else {
      const hl = seq.lengthVal.toString(16).padStart(4, "0").toUpperCase();
      combined.push(seq.identifier, hl.slice(0, 2), hl.slice(2, 4), ...seq.data);
    }
  }

  updateUsageUI(side, combined.length);

  // Split into Staging1/Staging2 and pad to required sizes
  entry.staging1Bytes = combined.slice(0, MAX_STAGING1);
  entry.staging2Bytes = combined.slice(MAX_STAGING1, MAX_STAGING1 + MAX_STAGING2);

  while (entry.staging1Bytes.length < MAX_STAGING1) entry.staging1Bytes.push("00");
  while (entry.staging2Bytes.length < MAX_STAGING2) entry.staging2Bytes.push("00");

  const i1 = document.getElementById(`${side}Staging1`);
  const i2 = document.getElementById(`${side}Staging2`);
  if (i1) i1.value = buildByteString(entry.staging1Bytes);
  if (i2) i2.value = buildByteString(entry.staging2Bytes);
}
