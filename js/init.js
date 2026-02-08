// ============================================================================
// Init: Initialization, templates, clipboard
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

function clearAllFields() {
  document.getElementById("leftStaging1").value = "";
  document.getElementById("leftStaging2").value = "";
  document.getElementById("rightStaging1").value = "";
  document.getElementById("rightStaging2").value = "";
}

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

function updateURLParams() {
  try {
    const params = new URLSearchParams();
    const vehicle = document.getElementById('vehicleSelect').value;
    const template = document.getElementById('templateSelect').value;
    if (vehicle) params.set('vehicle', vehicle);
    if (template) params.set('template', template);
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  } catch (e) {
    // history.replaceState may be restricted on file:// protocol
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

// Initialize on load
window.onload = () => {
  initVehicles();
  loadSelectedTemplate();
  buildDynamicFields(); // Ensure initialization even if no template is selected
};
