// ============================================================================
// Core: Data model, byte parsing, reassembly
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
