let loadedTemplateKey = null;

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

function copyAllFields() {
  const data = {
    left1: document.getElementById('leftStaging1').value,
    left2: document.getElementById('leftStaging2').value,
    right1: document.getElementById('rightStaging1').value,
    right2: document.getElementById('rightStaging2').value,
  };
  navigator.clipboard.writeText(JSON.stringify(data))
    .then(() => console.log('All fields copied to clipboard'))
    .catch(err => console.error('Failed to copy all fields:', err));
}

function pasteAllFields() {
  navigator.clipboard.readText()
    .then(text => {
      const data = JSON.parse(text);
      document.getElementById('leftStaging1').value = data.left1 || '';
      document.getElementById('leftStaging2').value = data.left2 || '';
      document.getElementById('rightStaging1').value = data.right1 || '';
      document.getElementById('rightStaging2').value = data.right2 || '';
      buildDynamicFields();
      onDataEdited();
    })
    .catch(err => console.error('Failed to paste all fields:', err));
}

function clearAllFields() {
  document.getElementById("leftStaging1").value = "";
  document.getElementById("leftStaging2").value = "";
  document.getElementById("rightStaging1").value = "";
  document.getElementById("rightStaging2").value = "";
}

function buildDynamicFields() {
  // Parse input fields into byte arrays and sequences
  for (const side of ['left', 'right']) {
    const entry = sideData[side];

    const s1 = document.getElementById(`${side}Staging1`).value;
    const s2 = document.getElementById(`${side}Staging2`).value;

    entry.staging1Bytes = parseByteString(s1);
    entry.staging2Bytes = parseByteString(s2);

    ensureMaxSize(entry.staging1Bytes, MAX_STAGING1);
    ensureMaxSize(entry.staging2Bytes, MAX_STAGING2);

    entry.sequences = parseAllSequencesFromBytes(entry.staging1Bytes, entry.staging2Bytes);
    updateUsageUI(side, calculateSeqsSize(entry.sequences));
  }

  // Compute phase timeline and render
  const vehicleKey = document.getElementById("vehicleSelect").value;
  const config = VEHICLE_CONFIGS[vehicleKey] || VEHICLE_CONFIGS["generic"];
  currentPhaseTimeline = computePhaseTimeline(config, {
    left: sideData.left.sequences,
    right: sideData.right.sequences
  });

  renderDynamicSequences();
  rebuildAnimationPlayer();
}

function onDataEdited() {
  loadedTemplateKey = null;
  document.getElementById('templateSelect').value = '';
  updateURLParams();
}

function getAllBytes() {
  return [
    ...sideData.left.staging1Bytes,
    ...sideData.left.staging2Bytes,
    ...sideData.right.staging1Bytes,
    ...sideData.right.staging2Bytes,
  ];
}

function encodeAllBytesToBase64() {
  return btoa(getAllBytes().map(h => String.fromCharCode(parseInt(h, 16))).join(''));
}

function hasAnyNonZeroData() {
  return getAllBytes().some(b => b !== '00');
}

function updateURLParams() {
  try {
    const params = new URLSearchParams();
    const vehicle = document.getElementById('vehicleSelect').value;
    if (vehicle) params.set('vehicle', vehicle);

    if (loadedTemplateKey) {
      params.set('template', loadedTemplateKey);
    } else if (hasAnyNonZeroData()) {
      params.set('d', encodeAllBytesToBase64());
    }

    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  } catch (e) {
    // replaceState may be restricted on file:// protocol
  }
}

function restoreFromURLData() {
  const urlParams = new URLSearchParams(window.location.search);
  const encoded = urlParams.get('d');
  if (!encoded) return false;

  try {
    const binary = atob(encoded);
    // 252 + 168 + 252 + 168 = 840 bytes total
    if (binary.length !== 840) return false;

    const toHexArray = (start, len) =>
      Array.from({ length: len }, (_, i) =>
        binary.charCodeAt(start + i).toString(16).padStart(2, '0').toUpperCase()
      );

    sideData.left.staging1Bytes = toHexArray(0, 252);
    sideData.left.staging2Bytes = toHexArray(252, 168);
    sideData.right.staging1Bytes = toHexArray(420, 252);
    sideData.right.staging2Bytes = toHexArray(672, 168);

    document.getElementById('leftStaging1').value = buildByteString(sideData.left.staging1Bytes);
    document.getElementById('leftStaging2').value = buildByteString(sideData.left.staging2Bytes);
    document.getElementById('rightStaging1').value = buildByteString(sideData.right.staging1Bytes);
    document.getElementById('rightStaging2').value = buildByteString(sideData.right.staging2Bytes);

    return true;
  } catch (e) {
    console.error('Failed to restore from URL data:', e);
    return false;
  }
}

function getDefault(paramName, configValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName) || configValue || "";
}

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

  const configVal = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG.defaultTemplate : "";
  const defaultTemplate = getDefault('template', configVal);
  if (defaultTemplate && TEMPLATES[defaultTemplate]) {
    select.value = defaultTemplate;
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

  const configVal = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG.defaultVehicle : "";
  const defaultVehicle = getDefault('vehicle', configVal);
  if (defaultVehicle && VEHICLE_CONFIGS[defaultVehicle]) {
    select.value = defaultVehicle;
  }
}

function loadSelectedTemplate() {
  const select = document.getElementById('templateSelect');
  const key = select.value;

  if (!key || !TEMPLATES[key]) return;

  loadedTemplateKey = key;

  const data = TEMPLATES[key];

  document.getElementById('leftStaging1').value = data.left1 || "";
  document.getElementById('leftStaging2').value = data.left2 || "";
  document.getElementById('rightStaging1').value = data.right1 || "";
  document.getElementById('rightStaging2').value = data.right2 || "";

  buildDynamicFields();
}

window.addEventListener('DOMContentLoaded', initTemplates);

window.onload = () => {
  initVehicles();
  const restoredFromURL = restoreFromURLData();
  if (!restoredFromURL) {
    loadSelectedTemplate();
  } else {
    document.getElementById('templateSelect').value = '';
  }
  buildDynamicFields();
  updateURLParams();
};
