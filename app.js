/* ============================================================
   PHE COST ESTIMATION SYSTEM — app.js
   Vanilla JS, component-based, state-managed
   ============================================================ */

// ── State ────────────────────────────────────────────────────
const STATE = loadState() || {
  user: null,
  currentStep: -1, // -1 = login
  schemeDetails: {},
  incidentDate: '',
  selectedComponents: [],
  pipes: [],
  labour: [],
  carriage: [],
  hardware: [],
};

function saveState() {
  localStorage.setItem('phe_estimation_state', JSON.stringify(STATE));
}

function loadState() {
  try {
    const s = localStorage.getItem('phe_estimation_state');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// ── Theme Management ──────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('phe_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('phe_theme', next);
  // Update all toggle buttons
  document.querySelectorAll('.theme-toggle-label').forEach(el => {
    el.textContent = next === 'dark' ? 'Dark' : 'Light';
  });
  document.querySelectorAll('.theme-toggle-icon').forEach(el => {
    el.textContent = next === 'dark' ? '🌙' : '☀️';
  });
}

// Init theme immediately
initTheme();

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const icon = type === 'success' ? '✅' : '❌';
  const tc = document.getElementById('toast-container') || createToastContainer();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function createToastContainer() {
  const d = document.createElement('div');
  d.id = 'toast-container';
  d.className = 'toast-container';
  document.body.appendChild(d);
  return d;
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function numberToWords(n) {
  if (n === 0) return 'Zero';
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven',
    'Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const c = (num) => {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num/10)] + (num%10 ? ' '+a[num%10] : '');
    return a[Math.floor(num/100)]+' Hundred'+(num%100 ? ' '+c(num%100) : '');
  };
  let str = '';
  const intPart = Math.floor(n);
  if (intPart >= 10000000) { str += c(Math.floor(intPart/10000000))+' Crore '; n %= 10000000; }
  if (intPart >= 100000)   { str += c(Math.floor((intPart%10000000)/100000))+' Lakh '; n %= 100000; }
  if (intPart >= 1000)     { str += c(Math.floor((intPart%100000)/1000))+' Thousand '; n %= 1000; }
  str += c(intPart % 1000);
  return str.trim() + ' Rupees Only';
}

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function validate(fields) {
  let valid = true;
  fields.forEach(({ el, msg }) => {
    const errEl = el.parentElement.querySelector('.form-error') ||
                  el.closest('.form-group')?.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
      valid = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });
  return valid;
}

// ── Step config ───────────────────────────────────────────────
// ── Base steps (always shown) ─────────────────────────────────
const BASE_STEPS_START = [
  { name: 'Scheme',     icon: '🏛️', key: 'scheme'     },
  { name: 'Incident',   icon: '📅', key: 'incident'   },
  { name: 'Components', icon: '🧩', key: 'components' },
];

const BASE_STEPS_END = [
  { name: 'Labour',   icon: '👷', key: 'labour'   },
  { name: 'Carriage', icon: '🚛', key: 'carriage' },
  { name: 'Hardware', icon: '🔧', key: 'hardware' },
  { name: 'Preview',  icon: '🧾', key: 'preview'  },
];

// ── Component-specific step blocks ────────────────────────────
const COMPONENT_STEP_BLOCKS = {
  pipeline: [
    { name: 'Pipes',    icon: '🚰', key: 'pipes'       },
    { name: 'Fittings', icon: '🔩', key: 'fittings'    },
    { name: 'Summary',  icon: '📊', key: 'pipe_summary'},
  ],
  valves: [
    { name: 'Valves', icon: '⚙️', key: 'valves_step' },
  ],
  submersible: [
    { name: 'Submersible', icon: '💧', key: 'submersible_step' },
  ],
  centrifugal: [
    { name: 'Centrifugal', icon: '🔩', key: 'centrifugal_step' },
  ],
  electrical: [
    { name: 'Electrical', icon: '⚡', key: 'electrical_step' },
  ],
  esr: [
    { name: 'ESR', icon: '🏗️', key: 'esr_step' },
  ],
  // Coming soon
  rapid_sand:  [{ name: 'Rapid Sand',  icon: '🏗️', key: 'coming_rapid_sand' }],
  ugr:         [{ name: 'UGR',         icon: '🏚️', key: 'coming_ugr'        }],
  civil:       [{ name: 'Civil',       icon: '🧱', key: 'coming_civil'      }],
};

// ── Build dynamic STEPS from selected components ───────────────
function buildSteps() {
  const selected = STATE.selectedComponents || [];
  let middle = [];
  if (selected.length === 0) {
    // Default: show pipes flow if nothing selected yet
    middle = COMPONENT_STEP_BLOCKS['pipeline'] || [];
  } else {
    selected.forEach(id => {
      const block = COMPONENT_STEP_BLOCKS[id];
      if (block) middle = middle.concat(block);
    });
  }
  return [...BASE_STEPS_START, ...middle, ...BASE_STEPS_END];
}

// ── Current step list (recomputed on each render) ─────────────
let STEPS = buildSteps();

// ── Map step key → renderer ───────────────────────────────────
const STEP_RENDERERS = {
  scheme:            () => renderStepScheme(),
  incident:          () => renderStepIncident(),
  components:        () => renderStepComponents(),
  pipes:             () => renderStepPipesOnly(),
  fittings:          () => renderStepFittings(),
  pipe_summary:      () => renderStepPipeSummary(),
  valves_step:       () => renderGenericItemStep('⚙️ Valves & Accessories', 'Select valve type and size — official SOR rates', '⚙️', VALVES_ITEMS, 'valves_items'),
  submersible_step:  () => renderGenericItemStep('💧 Submersible Pump', 'Lifting, servicing and replacement items — official SOR rates', '💧', SUBMERSIBLE_ITEMS, 'submersible_items'),
  centrifugal_step:  () => renderGenericItemStep('🔩 Centrifugal Pump', 'Removal, servicing and replacement items — official SOR rates', '🔩', CENTRIFUGAL_ITEMS, 'centrifugal_items'),
  electrical_step:   () => renderGenericItemStep('⚡ Electrical Items', 'Starters, wiring and electrical components — official SOR rates', '⚡', ELECTRICAL_ITEMS, 'electrical_items'),
  esr_step:          () => renderGenericItemStep('🏗️ ESR Painting', 'Anti-corrosive painting of ESR staging — official SOR rates', '🏗️', ESR_ITEMS, 'esr_items'),
  labour:            () => renderStepLabour(),
  carriage:          () => renderStepCarriage(),
  hardware:          () => renderStepHardware(),
  preview:           () => renderStepPreview(),
};

// Coming soon keys
Object.keys(COMPONENT_STEP_BLOCKS).forEach(id => {
  COMPONENT_STEP_BLOCKS[id].forEach(s => {
    if (s.key.startsWith('coming_')) {
      STEP_RENDERERS[s.key] = () => renderStepComingSoon(s.name, s.icon);
    }
  });
});

// ── Component data ────────────────────────────────────────────
const COMPONENTS = [
  { id: 'pipeline',     label: 'Repair & Replacement of Pipelines & Accessories in Distribution Network', icon: '🚰' },
  { id: 'valves',       label: 'Repair & Replacement of Valves & Accessories',                           icon: '⚙️' },
  { id: 'rapid_sand',   label: 'Repair & Replacement of Rapid Sand Filter Media',                        icon: '🏗️' },
  { id: 'submersible',  label: 'Repair & Replacement of Submersible Pump & Accessories',                 icon: '💧' },
  { id: 'centrifugal',  label: 'Repair & Replacement of Centrifugal Pump & Accessories',                 icon: '🔩' },
  { id: 'electrical',   label: 'Repair & Replacement of Electrical Items',                               icon: '⚡' },
  { id: 'ugr',          label: 'Maintenance works of Under Ground Reservoir (UGR)',                      icon: '🏚️' },
  { id: 'esr',          label: 'Maintenance works of Elevated Service Reservoir (ESR)',                  icon: '🏗️' },
  { id: 'civil',        label: 'Civil Works',                                                            icon: '🧱' },
];

// ═══════════════════════════════════════════════════════════════
// SOR BASE RATES — Auto-generated from official Excel schedule
// PHE Dept: Minor Repair & Replacement of PWSS Components
// ═══════════════════════════════════════════════════════════════

const PIPE_CATALOGUE = {
  CI: {
    pipes: [
      { desc: 'CI Pipe 100 mm dia', unit: 'Rm', rate: 3128.0 },
      { desc: 'CI Pipe 150 mm dia', unit: 'Rm', rate: 5060.0 },
    ],
    fittings: [
      // 
      { desc: 'CI Flange 100 mm dia', unit: 'Per Piece', rate: 386.0 },
      { desc: 'CI Flange 150 mm dia', unit: 'Per Piece', rate: 617.0 },
      { desc: 'CI Bend (Flanged Type) 100 mm dia', unit: 'Per Piece', rate: 1564.0 },
      { desc: 'CI Bend (Flanged Type) 150 mm dia', unit: 'Per Piece', rate: 2852.0 },
      { desc: 'CI Tee (Flanged Type) 100 mm dia', unit: 'Per Piece', rate: 2392.0 },
      { desc: 'CI Tee (Flanged Type) 150 mm dia', unit: 'Per Piece', rate: 4324.0 },
      { desc: 'Cast Iron (CI) Reducer 150 mm x 100 mm dia (Flanged Type)', unit: 'Per Piece', rate: 2300.0 },
      { desc: 'Cast Iron (CI) Welding Electrodes, of 2 mm dia and 350 mm in length', unit: 'Per Piece', rate: 2200.0 },
    ],
  },
  GI: {
    pipes: [
      { desc: 'GI Pipes (50 mm dia)', unit: 'Rm', rate: 548.0 },
      { desc: 'GI Pipes (65 mm dia)', unit: 'Rm', rate: 293.0 },
      { desc: 'GI Pipes (80 mm dia)', unit: 'Rm', rate: 426.0 },
      { desc: 'GI Pipes (100 mm dia)', unit: 'Rm', rate: 717.0 },
      { desc: 'GI Pipes (125 mm dia)', unit: 'Rm', rate: 1708.0 },
      { desc: 'GI Pipes (150 mm dia)', unit: 'Rm', rate: 2116.0 },
    ],
    fittings: [
      // 
      { desc: 'GI Socket (50 mm dia)', unit: 'Per Piece', rate: 108.0 },
      { desc: 'GI Socket (65 mm dia)', unit: 'Per Piece', rate: 174.0 },
      { desc: 'GI Socket (80 mm dia)', unit: 'Per Piece', rate: 261.0 },
      { desc: 'GI Socket (100 mm dia)', unit: 'Per Piece', rate: 423.0 },
      { desc: 'GI Socket (125 mm dia)', unit: 'Per Piece', rate: 1860.0 },
      { desc: 'GI Socket (150 mm dia)', unit: 'Per Piece', rate: 2190.0 },
      { desc: 'GI Union Socket (50 mm dia)', unit: 'Per Piece', rate: 345.0 },
      { desc: 'GI Union Socket (65 mm dia)', unit: 'Per Piece', rate: 541.0 },
      { desc: 'GI Union Socket (80 mm dia)', unit: 'Per Piece', rate: 727.0 },
      { desc: 'GI Union Socket (100 mm dia)', unit: 'Per Piece', rate: 1789.0 },
      { desc: 'GI Union Socket (125 mm dia)', unit: 'Per Piece', rate: 3566.0 },
      { desc: 'GI Union Socket (150 mm dia)', unit: 'Per Piece', rate: 5583.0 },
      { desc: 'GI Threaded Flange (50 mm dia)', unit: 'Per Piece', rate: 270.0 },
      { desc: 'GI Threaded Flange (65 mm dia)', unit: 'Per Piece', rate: 370.0 },
      { desc: 'GI Threaded Flange (80 mm dia)', unit: 'Per Piece', rate: 391.0 },
      { desc: 'GI Threaded Flange (100 mm dia)', unit: 'Per Piece', rate: 499.0 },
      { desc: 'GI Threaded Flange (125 mm dia)', unit: 'Per Piece', rate: 675.0 },
      { desc: 'GI Threaded Flange (150 mm dia)', unit: 'Per Piece', rate: 714.0 },
      { desc: 'GI Bend (50 mm dia)', unit: 'Per Piece', rate: 230.0 },
      { desc: 'GI Bend (65 mm dia)', unit: 'Per Piece', rate: 352.0 },
      { desc: 'GI Bend (80 mm dia)', unit: 'Per Piece', rate: 525.0 },
      { desc: 'GI Bend (100 mm dia)', unit: 'Per Piece', rate: 1095.0 },
      { desc: 'GI Bend (125 mm dia)', unit: 'Per Piece', rate: 3100.0 },
      { desc: 'GI Bend (150 mm dia)', unit: 'Per Piece', rate: 3275.0 },
      { desc: 'GI Elbow (50 mm dia)', unit: 'Per Piece', rate: 145.0 },
      { desc: 'GI Elbow (65 mm dia)', unit: 'Per Piece', rate: 277.0 },
      { desc: 'GI Elbow (80 mm dia)', unit: 'Per Piece', rate: 394.0 },
      { desc: 'GI Elbow (100 mm dia)', unit: 'Per Piece', rate: 670.0 },
      { desc: 'GI Elbow (125 mm dia)', unit: 'Per Piece', rate: 2231.0 },
      { desc: 'GI Elbow (150 mm dia)', unit: 'Per Piece', rate: 2722.0 },
      { desc: 'GI Reducing Socket (65 x 50 mm dia )', unit: 'Per Piece', rate: 191.0 },
      { desc: 'GI Reducing Socket (80 x 65 mm dia)', unit: 'Per Piece', rate: 287.0 },
      { desc: 'GI Reducing Socket (100 x 80 mm dia)', unit: 'Per Piece', rate: 465.0 },
      { desc: 'GI Reducing Socket (125 x 100 mm dia)', unit: 'Per Piece', rate: 2045.0 },
      { desc: 'GI Reducing Socket (150 x 100 mm dia)', unit: 'Per Piece', rate: 2392.0 },
      { desc: 'GI Reducing Socket (150 x 125 mm dia)', unit: 'Per Piece', rate: 2272.0 },
      { desc: 'GI Reducing Tee (65 x 50 mm)', unit: 'Per Piece', rate: 387.0 },
      { desc: 'GI Reducing Tee (80 x 65 mm)', unit: 'Per Piece', rate: 566.0 },
      { desc: 'GI Reducing Tee (100 x 80 mm)', unit: 'Per Piece', rate: 945.0 },
      { desc: 'GI Reducing Tee (125 x 100 mm)', unit: 'Per Piece', rate: 3270.0 },
      { desc: 'GI Reducing Tee (150 x 100 mm)', unit: 'Per Piece', rate: 3785.0 },
      { desc: 'GI Reducing Tee (150 x 125 mm)', unit: 'Per Piece', rate: 3785.0 },
      { desc: 'GI Plug (50 mm dia)', unit: 'Per Piece', rate: 138.0 },
      { desc: 'GI Plug (65 mm dia)', unit: 'Per Piece', rate: 177.0 },
      { desc: 'GI Plug (80 mm dia)', unit: 'Per Piece', rate: 222.0 },
      { desc: 'GI Plug (100 mm dia)', unit: 'Per Piece', rate: 396.0 },
      { desc: 'GI Plug (125 mm dia)', unit: 'Per Piece', rate: 990.0 },
      { desc: 'GI Plug (150 mm dia)', unit: 'Per Piece', rate: 966.0 },
      { desc: 'GI Cap Plug (50 mm dia)', unit: 'Per Piece', rate: 201.0 },
      { desc: 'GI Cap Plug (65 mm dia)', unit: 'Per Piece', rate: 255.0 },
      { desc: 'GI Cap Plug (80 mm dia)', unit: 'Per Piece', rate: 416.0 },
      { desc: 'GI Cap Plug (100 mm dia)', unit: 'Per Piece', rate: 857.0 },
      { desc: 'GI Cap Plug (125 mm dia)', unit: 'Per Piece', rate: 2500.0 },
      { desc: 'GI Cap Plug (150 mm dia)', unit: 'Per Piece', rate: 2190.0 },
      { desc: 'GI Nipple 50 mm long (50 mm dia)', unit: 'Per Piece', rate: 53.0 },
      { desc: 'GI Nipple 50 mm long (65 mm dia)', unit: 'Per Piece', rate: 117.0 },
      { desc: 'GI Nipple 50 mm long (80 mm dia)', unit: 'Per Piece', rate: 99.0 },
      { desc: 'GI Nipple 50 mm long (100 mm dia)', unit: 'Per Piece', rate: 152.0 },
      { desc: 'GI Nipple 50 mm long (125mm dia)', unit: 'Per Piece', rate: 338.0 },
      { desc: 'GI Nipple 50 mm long (150mm dia)', unit: 'Per Piece', rate: 213.0 },
      { desc: 'GI Nipple 75 mm long (50 mm dia)', unit: 'Per Piece', rate: 72.0 },
      { desc: 'GI Nipple 75 mm long (65 mm dia)', unit: 'Per Piece', rate: 87.0 },
      { desc: 'GI Nipple 75 mm long (80 mm dia)', unit: 'Per Piece', rate: 101.0 },
      { desc: 'GI Nipple 75 mm long (100 mm dia)', unit: 'Per Piece', rate: 275.0 },
      { desc: 'GI Nipple 75 mm long (125 mm dia)', unit: 'Per Piece', rate: 441.0 },
      { desc: 'GI Nipple 75 mm long (150 mm dia)', unit: 'Per Piece', rate: 497.0 },
      { desc: 'GI Nipple 100 mm long (50 mm dia)', unit: 'Per Piece', rate: 191.0 },
      { desc: 'GI Nipple 100 mm long (65 mm dia)', unit: 'Per Piece', rate: 191.0 },
      { desc: 'GI Nipple 100 mm long (80 mm dia)', unit: 'Per Piece', rate: 164.0 },
      { desc: 'GI Nipple 100 mm long (100 mm dia)', unit: 'Per Piece', rate: 236.0 },
      { desc: 'GI Nipple 100 mm long (125 mm dia)', unit: 'Per Piece', rate: 696.0 },
      { desc: 'GI Nipple 100 mm long (150 mm dia)', unit: 'Per Piece', rate: 696.0 },
      { desc: 'GI Nipple 150 mm long (50 mm dia)', unit: 'Per Piece', rate: 299.0 },
      { desc: 'GI Nipple 150 mm long (65 mm dia)', unit: 'Per Piece', rate: 320.0 },
      { desc: 'GI Nipple 150 mm long (80 mm dia)', unit: 'Per Piece', rate: 338.0 },
      { desc: 'GI Nipple 150 mm long (100 mm dia)', unit: 'Per Piece', rate: 396.0 },
      { desc: 'GI Nipple 150 mm long (125 mm dia)', unit: 'Per Piece', rate: 464.0 },
      { desc: 'GI Nipple 150 mm long (150 mm dia)', unit: 'Per Piece', rate: 504.0 },
      { desc: 'GI Nipple 200 mm long (50 mm dia)', unit: 'Per Piece', rate: 164.0 },
      { desc: 'GI Nipple 200 mm long (65 mm dia)', unit: 'Per Piece', rate: 237.0 },
      { desc: 'GI Nipple 200 mm long (80 mm dia)', unit: 'Per Piece', rate: 261.0 },
      { desc: 'GI Nipple 200 mm long (100 mm dia)', unit: 'Per Piece', rate: 506.0 },
      { desc: 'GI Nipple 200 mm long (125 mm dia)', unit: 'Per Piece', rate: 528.0 },
      { desc: 'GI Nipple 200 mm long (150 mm dia)', unit: 'Per Piece', rate: 712.0 },
      { desc: 'GI Nuts and Bolts', unit: 'Per Kg', rate: 120.0 },
      { desc: 'Rubber Gasket', unit: 'Per Kg', rate: 150.0 },
      { desc: 'Lead Wool of thickness 0.2 mm', unit: 'Per Kg', rate: 212.0 },
      { desc: 'Holdite for joining GI pipe joints', unit: 'Per 500 g', rate: 260.0 },
    ],
  },
  UPVC: {
    pipes: [
      { desc: 'UPVC Pipes (63 mm dia-2 in)', unit: 'Rm', rate: 119.0 },
      { desc: 'UPVC Pipes (75 mm dia-2.1/2in)', unit: 'Rm', rate: 166.0 },
      { desc: 'UPVC Pipes (90 mm dia-3in)', unit: 'Rm', rate: 236.0 },
      { desc: 'UPVC Pipes (110 mm dia-4in)', unit: 'Rm', rate: 349.0 },
      { desc: 'UPVC Pipes (140 mm dia)', unit: 'Rm', rate: 558.0 },
      { desc: 'UPVC Pipes (160 mm dia)', unit: 'Rm', rate: 766.0 },
    ],
    fittings: [
      // 
      { desc: 'UPVC Socket (63 mm dia)', unit: 'Per Piece', rate: 299.0 },
      { desc: 'UPVC Socket (75 mm dia)', unit: 'Per Piece', rate: 320.0 },
      { desc: 'UPVC Socket (90 mm dia)', unit: 'Per Piece', rate: 338.0 },
      { desc: 'UPVC Socket (110 mm dia)', unit: 'Per Piece', rate: 396.0 },
      { desc: 'UPVC Socket (140 mm dia)', unit: 'Per Piece', rate: 464.0 },
      { desc: 'UPVC Socket (160 mm dia)', unit: 'Per Piece', rate: 504.0 },
      { desc: 'UPVC Male Threaded Adapter ( 63 mm dia)', unit: 'Per Piece', rate: 41.0 },
      { desc: 'UPVC Male Threaded Adapter ( 75 mm dia)', unit: 'Per Piece', rate: 62.0 },
      { desc: 'UPVC Male Threaded Adapter ( 90 mm dia)', unit: 'Per Piece', rate: 90.0 },
      { desc: 'UPVC Male Threaded Adapter ( 110 mm dia)', unit: 'Per Piece', rate: 184.0 },
      { desc: 'UPVC Male Threaded Adapter ( 140 mm dia)', unit: 'Per Piece', rate: 253.0 },
      { desc: 'UPVC Male Threaded Adapter ( 160 mm dia)', unit: 'Per Piece', rate: 437.0 },
      { desc: 'UPVC Female Threaded Adapter (63 mm dia)', unit: 'Per Piece', rate: 51.0 },
      { desc: 'UPVC Female Threaded Adapter (75 mm dia)', unit: 'Per Piece', rate: 81.0 },
      { desc: 'UPVC Female Threaded Adapter (90 mm dia)', unit: 'Per Piece', rate: 124.0 },
      { desc: 'UPVC Female Threaded Adapter (110 mm dia)', unit: 'Per Piece', rate: 200.0 },
      { desc: 'UPVC Female Threaded Adapter (140 mm dia)', unit: 'Per Piece', rate: 514.0 },
      { desc: 'UPVC Female Threaded Adapter (160 mm dia)', unit: 'Per Piece', rate: 422.0 },
      { desc: 'UPVC Elbow (63 mm dia)', unit: 'Per Piece', rate: 77.0 },
      { desc: 'UPVC Elbow (75 mm dia)', unit: 'Per Piece', rate: 105.0 },
      { desc: 'UPVC Elbow (90 mm dia)', unit: 'Per Piece', rate: 155.0 },
      { desc: 'UPVC Elbow (110 mm dia)', unit: 'Per Piece', rate: 290.0 },
      { desc: 'UPVC Elbow (140 mm dia)', unit: 'Per Piece', rate: 535.0 },
      { desc: 'UPVC Elbow (160 mm dia)', unit: 'Per Piece', rate: 627.0 },
      { desc: 'UPVC Equal Tee (63 mm dia)', unit: 'Per Piece', rate: 106.0 },
      { desc: 'UPVC Equal Tee (75 mm dia)', unit: 'Per Piece', rate: 152.0 },
      { desc: 'UPVC Equal Tee (90 mm dia)', unit: 'Per Piece', rate: 230.0 },
      { desc: 'UPVC Equal Tee (110 mm dia)', unit: 'Per Piece', rate: 408.0 },
      { desc: 'UPVC Equal Tee (140 mm dia)', unit: 'Per Piece', rate: 726.0 },
      { desc: 'UPVC Equal Tee (160 mm dia)', unit: 'Per Piece', rate: 1253.0 },
      { desc: 'UPVC Reducing Socket (75 x 63 mm dia)', unit: 'Per Piece', rate: 53.0 },
      { desc: 'UPVC Reducing Socket (75 x 50 mm dia)', unit: 'Per Piece', rate: 45.0 },
      { desc: 'UPVC Reducing Socket (90 x 75 mm dia)', unit: 'Per Piece', rate: 76.0 },
      { desc: 'UPVC Reducing Socket (90 x 63 mm dia)', unit: 'Per Piece', rate: 77.0 },
      { desc: 'UPVC Reducing Socket (90 x 32 mm dia)', unit: 'Per Piece', rate: 85.0 },
      { desc: 'UPVC Reducing Socket (110 x 90 mm dia)', unit: 'Per Piece', rate: 126.0 },
      { desc: 'UPVC Reducing Socket (110 x 75 mm dia)', unit: 'Per Piece', rate: 110.0 },
      { desc: 'UPVC Reducing Socket (110 x 63 mm dia)', unit: 'Per Piece', rate: 135.0 },
      { desc: 'UPVC Reducing Socket (140 x 110 mm dia)', unit: 'Per Piece', rate: 226.0 },
      { desc: 'UPVC Reducing Socket (140 x 90 mm dia)', unit: 'Per Piece', rate: 179.0 },
      { desc: 'UPVC Reducing Socket (160 x 140 mm dia)', unit: 'Per Piece', rate: 245.0 },
      { desc: 'UPVC Reducing Socket (160 x 110 mm dia)', unit: 'Per Piece', rate: 290.0 },
      { desc: 'UPVC Reducing Socket (160 x 90 mm dia)', unit: 'Per Piece', rate: 194.0 },
      { desc: 'UPVC End Cap (63 mm dia)', unit: 'Per Piece', rate: 34.0 },
      { desc: 'UPVC End Cap (75 mm dia)', unit: 'Per Piece', rate: 49.0 },
      { desc: 'UPVC End Cap (90 mm dia)', unit: 'Per Piece', rate: 62.0 },
      { desc: 'UPVC End Cap (110 mm dia)', unit: 'Per Piece', rate: 87.0 },
      { desc: 'UPVC End Cap (140 mm dia)', unit: 'Per Piece', rate: 154.0 },
      { desc: 'UPVC End Cap (160 mm dia)', unit: 'Per Piece', rate: 279.0 },
      { desc: 'UPVC End Cap Threaded (63 mm dia)', unit: 'Per Piece', rate: 31.0 },
      { desc: 'UPVC End Cap Threaded (75 mm dia)', unit: 'Per Piece', rate: 58.0 },
      { desc: 'UPVC End Cap Threaded (90 mm dia)', unit: 'Per Piece', rate: 72.0 },
      { desc: 'UPVC End Cap Threaded (110 mm dia)', unit: 'Per Piece', rate: 117.0 },
      { desc: 'UPVC End Cap Threaded (140 mm dia)', unit: 'Per Piece', rate: 198.0 },
      { desc: 'UPVC End Cap Threaded (160 mm dia)', unit: 'Per Piece', rate: 280.0 },
      { desc: 'UPVC Service Saddle Piece (63 mm dia)', unit: 'Per Piece', rate: 124.0 },
      { desc: 'UPVC Service Saddle Piece (75 mm dia)', unit: 'Per Piece', rate: 188.0 },
      { desc: 'UPVC Service Saddle Piece (90 mm dia)', unit: 'Per Piece', rate: 278.0 },
      { desc: 'UPVC Service Saddle Piece (110 mm dia)', unit: 'Per Piece', rate: 314.0 },
      { desc: 'UPVC Service Saddle Piece (140 mm dia)', unit: 'Per Piece', rate: 267.0 },
      { desc: 'UPVC Service Saddle Piece (160 mm dia)', unit: 'Per Piece', rate: 316.0 },
      { desc: 'UPVC Tailpiece (63 mm dia)', unit: 'Per Piece', rate: 32.0 },
      { desc: 'UPVC Tailpiece (75 mm dia)', unit: 'Per Piece', rate: 45.0 },
      { desc: 'UPVC Tailpiece (90 mm dia)', unit: 'Per Piece', rate: 62.0 },
      { desc: 'UPVC Tailpiece (110 mm dia)', unit: 'Per Piece', rate: 128.0 },
      { desc: 'UPVC Tailpiece (140 mm dia)', unit: 'Per Piece', rate: 171.0 },
      { desc: 'UPVC Tailpiece (160 mm dia)', unit: 'Per Piece', rate: 308.0 },
      { desc: 'UPVC Flange (63 mm dia)', unit: 'Per Piece', rate: 58.0 },
      { desc: 'UPVC Flange (75 mm dia)', unit: 'Per Piece', rate: 67.0 },
      { desc: 'UPVC Flange (90 mm dia)', unit: 'Per Piece', rate: 76.0 },
      { desc: 'UPVC Flange (110 mm dia)', unit: 'Per Piece', rate: 121.0 },
      { desc: 'UPVC Flange (140 mm dia)', unit: 'Per Piece', rate: 750.0 },
      { desc: 'UPVC Flange (160 mm dia)', unit: 'Per Piece', rate: 845.0 },
      { desc: 'UPVC Bend 90˚(63 mm dia)', unit: 'Per Piece', rate: 64.0 },
      { desc: 'UPVC Bend 90˚(75 mm dia)', unit: 'Per Piece', rate: 89.0 },
      { desc: 'UPVC Bend 90˚(90 mm dia)', unit: 'Per Piece', rate: 172.0 },
      { desc: 'UPVC Bend 90˚(110 mm dia)', unit: 'Per Piece', rate: 271.0 },
      { desc: 'UPVC Bend 90˚(140 mm dia)', unit: 'Per Piece', rate: 432.0 },
      { desc: 'UPVC Bend 90˚(160 mm dia)', unit: 'Per Piece', rate: 730.0 },
      { desc: 'UPVC Bend 45˚(63 mm dia)', unit: 'Per Piece', rate: 65.0 },
      { desc: 'UPVC Bend 45˚(75 mm dia)', unit: 'Per Piece', rate: 88.0 },
      { desc: 'UPVC Bend 45˚(90 mm dia)', unit: 'Per Piece', rate: 151.0 },
      { desc: 'UPVC Bend 45˚(110 mm dia)', unit: 'Per Piece', rate: 233.0 },
      { desc: 'UPVC Bend 45˚(140 mm dia)', unit: 'Per Piece', rate: 271.0 },
      { desc: 'UPVC Bend 45˚(160 mm dia)', unit: 'Per Piece', rate: 560.0 },
      { desc: 'UPVC Reducing Tee (75 x 63 mm dia)', unit: 'Per Piece', rate: 158.0 },
      { desc: 'UPVC Reducing Tee (90 x 75 mm dia)', unit: 'Per Piece', rate: 181.0 },
      { desc: 'UPVC Reducing Tee (90 x 63 mm dia)', unit: 'Per Piece', rate: 203.0 },
      { desc: 'UPVC Reducing Tee (110 x 90 mm dia)', unit: 'Per Piece', rate: 406.0 },
      { desc: 'UPVC Reducing Tee (110 x 75 mm dia)', unit: 'Per Piece', rate: 268.0 },
      { desc: 'UPVC Reducing Tee (110 x 63 mm dia)', unit: 'Per Piece', rate: 293.0 },
      { desc: 'UPVC Reducing Tee (140 x 110 mm dia)', unit: 'Per Piece', rate: 630.0 },
      { desc: 'UPVC Reducing Tee (160 x 140 mm dia)', unit: 'Per Piece', rate: 695.0 },
      { desc: 'UPVC Reducing Tee (160 x 110 mm dia)', unit: 'Per Piece', rate: 702.0 },
      { desc: 'UPVC Reducing Tee (160 x 90 mm dia)', unit: 'Per Piece', rate: 760.0 },
      { desc: 'UPVC Reducing Bush (75 x 63 mm dia)', unit: 'Per Piece', rate: 45.0 },
      { desc: 'UPVC Reducing Bush (90 x 75 mm dia)', unit: 'Per Piece', rate: 59.0 },
      { desc: 'UPVC Reducing Bush (90 x 63 mm dia)', unit: 'Per Piece', rate: 95.0 },
      { desc: 'UPVC Reducing Bush (110 x 90 mm dia)', unit: 'Per Piece', rate: 115.0 },
      { desc: 'UPVC Reducing Bush (110 x 75 mm dia)', unit: 'Per Piece', rate: 106.0 },
      { desc: 'UPVC Reducing Bush (110 x 63 mm dia)', unit: 'Per Piece', rate: 104.0 },
      { desc: 'UPVC Reducing Bush (140 x 90 mm dia)', unit: 'Per Piece', rate: 272.0 },
      { desc: 'UPVC Reducing Bush (140 x 110 mm dia)', unit: 'Per Piece', rate: 199.0 },
      { desc: 'UPVC Reducing Bush (160 x 140 mm dia)', unit: 'Per Piece', rate: 264.0 },
      { desc: 'UPVC Reducing Bush (160 x 110 mm dia)', unit: 'Per Piece', rate: 264.0 },
      { desc: 'UPVC Flange Adaptor (63 mm dia)', unit: 'Per Piece', rate: 219.0 },
      { desc: 'UPVC Flange Adaptor (75 mm dia)', unit: 'Per Piece', rate: 293.0 },
      { desc: 'UPVC Flange Adaptor (90 mm dia)', unit: 'Per Piece', rate: 326.0 },
      { desc: 'UPVC Flange Adaptor (110 mm dia)', unit: 'Per Piece', rate: 586.0 },
      { desc: 'UPVC Flange Adaptor (140 mm dia)', unit: 'Per Piece', rate: 845.0 },
      { desc: 'UPVC Flange Adaptor (160 mm dia)', unit: 'Per Piece', rate: 845.0 },
      { desc: 'High-quality Yellow Teflon Tape (PTFE Thread Seal Tape), 1 inch (25.4 mm) wide, minimum 10 meters in length per roll, an', unit: 'Per Piece', rate: 46.0 },
      { desc: '250 ml Container', unit: 'Per Piece', rate: 175.0 },
      { desc: '500 ml Container', unit: 'Per Piece', rate: 344.0 },
      { desc: '1000 ml Container', unit: 'Per Piece', rate: 610.0 },
      { desc: '5 Litre Container', unit: 'Per Piece', rate: 2542.0 },
      { desc: '20 Litre Container', unit: 'Per Piece', rate: 8541.0 },
    ],
  },
  HDPE: {
    pipes: [
      { desc: 'HDPE Pipes (140 mm dia PN6)', unit: 'Rm', rate: 576.8 },
      { desc: 'HDPE Pipes (125 mm dia PN6)', unit: 'Rm', rate: 460.6 },
      { desc: 'HDPE Pipes (110 mm dia PN6)', unit: 'Rm', rate: 360.4 },
      { desc: 'HDPE Pipes (90 mm dia PN6)', unit: 'Rm', rate: 237.8 },
      { desc: 'HDPE Pipes (75 mm dia PN6)', unit: 'Rm', rate: 167.4 },
      { desc: 'HDPE Pipes (63 mm dia PN6)', unit: 'Rm', rate: 117.0 },
      { desc: 'HDPE Pipes (140 mm dia PN10)', unit: 'Rm', rate: 856.6 },
      { desc: 'HDPE Pipes (125 mm dia PN10)', unit: 'Rm', rate: 683.8 },
      { desc: 'HDPE Pipes (110 mm dia PN10)', unit: 'Rm', rate: 530.2 },
      { desc: 'HDPE Pipes (90 mm dia PN10)', unit: 'Rm', rate: 357.6 },
      { desc: 'HDPE Pipes (75 mm dia PN10)', unit: 'Rm', rate: 251.2 },
      { desc: 'HDPE Pipes (63 mm dia PN10)', unit: 'Rm', rate: 177.2 },
    ],
    fittings: [
      // 
      { desc: 'HDPE Equal Tee (160 mm dia)', unit: 'Per Piece', rate: 1230.0 },
      { desc: 'HDPE Equal Tee (140 mm dia)', unit: 'Per Piece', rate: 1025.0 },
      { desc: 'HDPE Equal Tee (125 mm dia)', unit: 'Per Piece', rate: 710.0 },
      { desc: 'HDPE Equal Tee (110 mm dia)', unit: 'Per Piece', rate: 294.0 },
      { desc: 'HDPE Equal Tee (90 mm dia)', unit: 'Per Piece', rate: 177.0 },
      { desc: 'HDPE Equal Tee (75 mm dia)', unit: 'Per Piece', rate: 120.0 },
      { desc: 'HDPE Equal Tee (63 mm dia)', unit: 'Per Piece', rate: 72.0 },
      { desc: 'HDPE Socket (160 mm dia)', unit: 'Per Piece', rate: 226.0 },
      { desc: 'HDPE Socket (140 mm dia)', unit: 'Per Piece', rate: 222.0 },
      { desc: 'HDPE Socket (125 mm dia)', unit: 'Per Piece', rate: 218.0 },
      { desc: 'HDPE Socket (110 mm dia)', unit: 'Per Piece', rate: 116.0 },
      { desc: 'HDPE Socket (90 mm dia)', unit: 'Per Piece', rate: 75.0 },
      { desc: 'HDPE Socket (75 mm dia)', unit: 'Per Piece', rate: 62.0 },
      { desc: 'HDPE Socket(63 mm dia)', unit: 'Per Piece', rate: 48.0 },
      { desc: 'HDPE Reducer (160 mm X 140 mm dia)', unit: 'Per Piece', rate: 651.0 },
      { desc: 'HDPE Reducer (140 mm X 125 mm dia)', unit: 'Per Piece', rate: 413.0 },
      { desc: 'HDPE Reducer (125 mm X 110 mm dia)', unit: 'Per Piece', rate: 413.0 },
      { desc: 'HDPE Reducer (110 mm X 90 mm dia)', unit: 'Per Piece', rate: 266.0 },
      { desc: 'HDPE Reducer (90 mm X 75 mm dia)', unit: 'Per Piece', rate: 175.0 },
      { desc: 'HDPE Reducer (75 mm X 63 mm dia)', unit: 'Per Piece', rate: 139.0 },
      { desc: 'HDPE Tail piece with GI Flange (160 mm dia)', unit: 'Per Piece', rate: 260.0 },
      { desc: 'HDPE Tail piece with GI Flange (140 mm dia)', unit: 'Per Piece', rate: 211.0 },
      { desc: 'HDPE Tail piece with GI Flange (125 mm dia)', unit: 'Per Piece', rate: 211.0 },
      { desc: 'HDPE Tail piece with GI Flange (110 mm dia)', unit: 'Per Piece', rate: 136.0 },
      { desc: 'HDPE Tail piece with GI Flange (90 mm dia)', unit: 'Per Piece', rate: 93.0 },
      { desc: 'HDPE Tail piece with GI Flange (75 mm dia)', unit: 'Per Piece', rate: 81.0 },
      { desc: 'HDPE Tail piece with GI Flange (63 mm dia)', unit: 'Per Piece', rate: 69.0 },
      { desc: 'HDPE Electrofusion Coupler piece160 mm dia', unit: 'Per Piece', rate: 850.0 },
      { desc: 'HDPE Electrofusion Coupler piece 140 mm dia', unit: 'Per Piece', rate: 690.0 },
      { desc: 'HDPE Electrofusion Coupler piece 125 mm dia', unit: 'Per Piece', rate: 585.0 },
      { desc: 'HDPE Electrofusion Coupler piece 110 mm dia', unit: 'Per Piece', rate: 355.0 },
      { desc: 'HDPE Electrofusion Coupler piece 90 mm dia', unit: 'Per Piece', rate: 280.0 },
      { desc: 'HDPE Electrofusion Coupler piece 75 mm dia', unit: 'Per Piece', rate: 210.0 },
      { desc: 'HDPE Electrofusion Coupler piece 63 mm dia', unit: 'Per Piece', rate: 170.0 },
      { desc: 'HDPE Electrofusion Elbow piece160 mm dia', unit: 'Per Piece', rate: 2700.0 },
      { desc: 'HDPE Electrofusion Elbow piece 140 mm dia', unit: 'Per Piece', rate: 1785.0 },
      { desc: 'HDPE Electrofusion Elbow piece 125 mm dia', unit: 'Per Piece', rate: 1540.0 },
      { desc: 'HDPE Electrofusion Elbow piece 110 mm dia', unit: 'Per Piece', rate: 792.0 },
      { desc: 'HDPE Electrofusion Elbow piece 90 mm dia', unit: 'Per Piece', rate: 660.0 },
      { desc: 'HDPE Electrofusion Elbow piece 75 mm dia', unit: 'Per Piece', rate: 380.0 },
      { desc: 'HDPE Electrofusion Elbow piece 63 mm dia', unit: 'Per Piece', rate: 245.0 },
      { desc: 'HDPE Electrofusion Tee piece160 mm dia', unit: 'Per Piece', rate: 3090.0 },
      { desc: 'HDPE Electrofusion Tee piece 140 mm dia', unit: 'Per Piece', rate: 2142.0 },
      { desc: 'HDPE Electrofusion Tee piece 125 mm dia', unit: 'Per Piece', rate: 1670.0 },
      { desc: 'HDPE Electrofusion Tee piece 110 mm dia', unit: 'Per Piece', rate: 880.0 },
      { desc: 'HDPE Electrofusion Tee piece 90 mm dia', unit: 'Per Piece', rate: 704.0 },
      { desc: 'HDPE Electrofusion Tee piece 75 mm dia', unit: 'Per Piece', rate: 396.0 },
      { desc: 'HDPE Electrofusion Tee piece 63 mm dia', unit: 'Per Piece', rate: 286.0 },
      { desc: 'HDPE Electrofusion Reducer (160 mm X 140 mm dia)', unit: 'Per Piece', rate: 1794.0 },
      { desc: 'HDPE Electrofusion Reducer (140 mm X 125 mm dia)', unit: 'Per Piece', rate: 1381.0 },
      { desc: 'HDPE Electrofusion Reducer (125 mm X 110 mm dia)', unit: 'Per Piece', rate: 1200.0 },
      { desc: 'HDPE Electrofusion Reducer (110 mm X 90 mm dia)', unit: 'Per Piece', rate: 710.0 },
      { desc: 'HDPE Electrofusion Reducer (90 mm X 75 mm dia)', unit: 'Per Piece', rate: 580.0 },
      { desc: 'HDPE Electrofusion Reducer (75 mm X 63 mm dia)', unit: 'Per Piece', rate: 420.0 },
    ],
  },
  PPR: {
    pipes: [
      { desc: 'PPR Pipe 20 mm dia OD', unit: 'Rm', rate: 97.0 },
    ],
    fittings: [
      // 
      { desc: 'Elbow : 20 mm diameter', unit: 'Per Piece', rate: 19.0 },
      { desc: '15 mm diameter Bronze Ferrule Cock, PN-16', unit: 'Per Piece', rate: 499.0 },
      { desc: 'Saddle Piece (160 mm dia)', unit: 'Per Piece', rate: 360.0 },
      { desc: 'Saddle Piece (140 mm dia)', unit: 'Per Piece', rate: 297.0 },
      { desc: 'Saddle Piece (125 mm dia)', unit: 'Per Piece', rate: 240.0 },
      { desc: 'Saddle Piece (110 mm dia)', unit: 'Per Piece', rate: 205.0 },
      { desc: 'Saddle Piece (90 mm dia)', unit: 'Per Piece', rate: 146.0 },
      { desc: 'Saddle Piece (75 mm dia)', unit: 'Per Piece', rate: 147.0 },
      { desc: 'Saddle Piece (63 mm dia)', unit: 'Per Piece', rate: 124.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (160x15 mm dia)', unit: 'Per Piece', rate: 357.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (140x15 mm dia)', unit: 'Per Piece', rate: 337.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (125x15 mm dia)', unit: 'Per Piece', rate: 337.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (110x15 mm dia)', unit: 'Per Piece', rate: 218.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (90x15 mm dia)', unit: 'Per Piece', rate: 199.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (75x15 mm dia)', unit: 'Per Piece', rate: 180.0 },
      { desc: 'Integrated Saddle clamp type inbuilt with flow control valve Piece (63x15 mm dia)', unit: 'Per Piece', rate: 171.0 },
      { desc: 'Plastic Bib Cock of 15 mm diameter', unit: 'Per Piece', rate: 25.0 },
      { desc: 'Plastic Bib Cock of 20 mm diameter\\', unit: 'Per Piece', rate: 87.0 },
      { desc: 'Gunmetal Bib Cock (15 mm)', unit: 'Per Piece', rate: 215.0 },
      { desc: 'Gunmetal Bib Cock (20 mm)', unit: 'Per Piece', rate: 240.0 },
    ],
  },
  DI: {
    pipes: [
      { desc: '80 mm dia', unit: 'Per meter', rate: 1150.0 },
      { desc: '100 mm dia', unit: 'Per meter', rate: 1216.0 },
      { desc: '125 mm dia', unit: 'Per meter', rate: 1386.0 },
      { desc: '150 mm dia', unit: 'Per meter', rate: 1600.0 },
      { desc: '200 mm dia', unit: 'Per meter', rate: 1996.0 },
      { desc: '250 mm dia', unit: 'Per meter', rate: 2700.0 },
      { desc: '300 mm dia', unit: 'Per meter', rate: 3412.0 },
      { desc: '350 mm dia', unit: 'Per meter', rate: 3800.0 },
      { desc: '400 mm dia', unit: 'Per meter', rate: 4565.0 },
      { desc: '450 mm dia', unit: 'Per meter', rate: 5295.0 },
      { desc: '500 mm dia', unit: 'Per meter', rate: 6130.0 },
      { desc: '600 mm dia', unit: 'Per meter', rate: 8097.0 },
      { desc: '700 mm dia', unit: 'Per meter', rate: 10500.0 },
      { desc: '750 mm dia', unit: 'Per meter', rate: 12497.0 },
      { desc: '800 mm dia', unit: 'Per meter', rate: 14170.0 },
      { desc: '900 mm dia', unit: 'Per meter', rate: 16700.0 },
      { desc: '1000 mm dia', unit: 'Per meter', rate: 19875.0 },
      { desc: '80 mm dia', unit: 'Per meter', rate: 1190.0 },
      { desc: '100 mm dia', unit: 'Per meter', rate: 1373.0 },
      { desc: '125 mm dia', unit: 'Per meter', rate: 1541.0 },
      { desc: '150 mm', unit: 'Per meter', rate: 2026.3 },
      { desc: '200 mm', unit: 'Per meter', rate: 2749.65 },
      { desc: '250 mm', unit: 'Per meter', rate: 3684.6 },
      { desc: '300 mm', unit: 'Per meter', rate: 4658.65 },
      { desc: '350 mm', unit: 'Per meter', rate: 4429.0 },
      { desc: '400 mm', unit: 'Per meter', rate: 5213.0 },
      { desc: '450 mm', unit: 'Per meter', rate: 6200.0 },
      { desc: '500 mm', unit: 'Per meter', rate: 7173.0 },
      { desc: '600 mm', unit: 'Per meter', rate: 9400.0 },
      { desc: '700 mm', unit: 'Per meter', rate: 11773.0 },
      { desc: '750 mm', unit: 'Per meter', rate: 13642.0 },
      { desc: '800 mm', unit: 'Per meter', rate: 15100.0 },
      { desc: '900 mm', unit: 'Per meter', rate: 17838.0 },
      { desc: '1000 mm', unit: 'Per meter', rate: 21172.0 },
      { desc: 'Ductile Iron Socket/ Spigot Pipes Class-K7 As per IS:8329/2000 :750 mm', unit: 'Per meter', rate: 11528.0 },
    ],
    fittings: [
      { desc: '100 mm - 200 mm', unit: 'Per Kg', rate: 128.8 },
      { desc: '250 mm - 300 mm', unit: 'Per Kg', rate: 190.0 },
      { desc: '350 mm - 450 mm', unit: 'Per Kg', rate: 190.0 },
      { desc: '500 mm - 600 mm', unit: 'Per Kg', rate: 197.0 },
      { desc: '700 mm - 750 mm', unit: 'Per Kg', rate: 201.25 },
      { desc: '800 mm', unit: 'Per Kg', rate: 201.25 },
      { desc: '900 mm', unit: 'Per Kg', rate: 212.75 },
      { desc: '1000 mm', unit: 'Per Kg', rate: 231.15 },
      { desc: '100 mm - 200 mm', unit: 'Per Kg', rate: 134.55 },
      { desc: '250 mm - 300 mm', unit: 'Per Kg', rate: 171.0 },
      { desc: '350 mm - 450 mm', unit: 'Per Kg', rate: 178.0 },
      { desc: '500 mm - 600 mm', unit: 'Per Kg', rate: 185.0 },
      { desc: '700 mm - 750 mm', unit: 'Per Kg', rate: 205.0 },
      { desc: '800 mm', unit: 'Per Kg', rate: 212.75 },
      { desc: '900 mm', unit: 'Per Kg', rate: 231.15 },
      { desc: '1000 mm', unit: 'Per Kg', rate: 231.15 },
      { desc: 'Up to 500 x 500 mm', unit: 'Per Kg', rate: 200.0 },
      { desc: 'Above 500 x 500 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 500 mm', unit: 'Per Kg', rate: 197.5 },
      { desc: 'Above 500 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 500 x 450 mm', unit: 'Per Kg', rate: 200.0 },
      { desc: 'Above 500 x 450 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 300 mm', unit: 'Per Kg', rate: 193.0 },
      { desc: 'Above 300 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 300 mm', unit: 'Per Kg', rate: 206.5 },
      { desc: 'Above 300 mm', unit: 'Per Kg', rate: 206.5 },
      { desc: 'Up to 300 mm', unit: 'Per Kg', rate: 203.5 },
      { desc: 'Above 300 mm', unit: 'Per Kg', rate: 207.0 },
      { desc: 'Up to 300 mm', unit: 'Per Kg', rate: 193.0 },
      { desc: 'Above 300 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 500 x 450 mm', unit: 'Per Kg', rate: 193.0 },
      { desc: 'Above 500 x 450 mm', unit: 'Per Kg', rate: 165.69 },
      { desc: 'Up to 500 mm', unit: 'Per Kg', rate: 193.0 },
      { desc: 'Above 500 mm', unit: 'Per Kg', rate: 208.0 },
      { desc: 'Up to 300 mm', unit: 'Per Kg', rate: 203.5 },
      { desc: 'Above 300 mm', unit: 'Per Kg', rate: 207.0 },
      { desc: 'Up to 500 mm', unit: 'Per Kg', rate: 193.0 },
      { desc: 'Above 500 mm', unit: 'Per Kg', rate: 208.0 },
    ],
  },
};

const PIPE_TYPES = ['CI','GI','UPVC','HDPE','PPR','DI'];

const LABOUR_ITEMS = [
  { desc: 'Head Carpenter', unit: 'Per day per person', rate: 897.0 },
  { desc: 'Head Mason', unit: 'Per day per person', rate: 897.0 },
  { desc: 'Head welder', unit: 'Per day per person', rate: 897.0 },
  { desc: 'Carpenter', unit: 'Per day per person', rate: 816.0 },
  { desc: 'Mason', unit: 'Per day per person', rate: 816.0 },
  { desc: 'Plumber', unit: 'Per day per person', rate: 973.0 },
  { desc: 'Painter', unit: 'Per day per person', rate: 816.0 },
  { desc: 'Electrician', unit: 'Per day per person', rate: 973.0 },
  { desc: 'Technician', unit: 'Per day per person', rate: 973.0 },
  { desc: 'Welder', unit: 'Per day per person', rate: 239.2 },
  { desc: 'Plumber', unit: 'Per day per person', rate: 239.2 },
  { desc: 'Polisher (Furniture)', unit: 'Per day per person', rate: 239.2 },
  { desc: 'Painter', unit: 'Per day per person', rate: 239.2 },
  { desc: 'Skilled Labourers', unit: 'Per day per person', rate: 450.0 },
  { desc: 'Semi Skilled Labourer', unit: 'Per day per person', rate: 280.0 },
  { desc: 'Ordinary Labourer', unit: 'Per day per person', rate: 240.0 },
];

const CARRIAGE_ITEMS = [
  { desc: 'Carriage UPTO 10 Kg — 0-10 km lead', unit: 'Per Trip', rate: 900.0 },
  { desc: 'Carriage UPTO 10 Kg — 11-20 km lead', unit: 'Per Trip', rate: 1200.0 },
  { desc: 'Carriage UPTO 10 Kg — 21-50 km lead', unit: 'Per Trip', rate: 2500.0 },
  { desc: 'Carriage UPTO 10 Kg — 51-100 km lead', unit: 'Per Trip', rate: 4000.0 },
  { desc: 'Carriage 11-50 Kg — 0-10 km lead', unit: 'Per Trip', rate: 1200.0 },
  { desc: 'Carriage 11-50 Kg — 11-20 km lead', unit: 'Per Trip', rate: 1800.0 },
  { desc: 'Carriage 11-50 Kg — 21-50 km lead', unit: 'Per Trip', rate: 2900.0 },
  { desc: 'Carriage 11-50 Kg — 51-100 km lead', unit: 'Per Trip', rate: 4500.0 },
  { desc: 'Carriage 51-100 Kg — 0-10 km lead', unit: 'Per Trip', rate: 2500.0 },
  { desc: 'Carriage 51-100 Kg — 11-20 km lead', unit: 'Per Trip', rate: 3000.0 },
  { desc: 'Carriage 51-100 Kg — 21-50 km lead', unit: 'Per Trip', rate: 3800.0 },
  { desc: 'Carriage 51-100 Kg — 51-100 km lead', unit: 'Per Trip', rate: 5500.0 },
  { desc: 'Carriage 101-300 Kg — 0-10 km lead', unit: 'Per Trip', rate: 3000.0 },
  { desc: 'Carriage 101-300 Kg — 11-20 km lead', unit: 'Per Trip', rate: 3400.0 },
  { desc: 'Carriage 101-300 Kg — 21-50 km lead', unit: 'Per Trip', rate: 4500.0 },
  { desc: 'Carriage 101-300 Kg — 51-100 km lead', unit: 'Per Trip', rate: 6000.0 },
  { desc: 'Carriage 301-500 Kg — 0-10 km lead', unit: 'Per Trip', rate: 3000.0 },
  { desc: 'Carriage 301-500 Kg — 11-20 km lead', unit: 'Per Trip', rate: 3500.0 },
  { desc: 'Carriage 301-500 Kg — 21-50 km lead', unit: 'Per Trip', rate: 4500.0 },
  { desc: 'Carriage 301-500 Kg — 51-100 km lead', unit: 'Per Trip', rate: 6500.0 },
  { desc: 'Carriage 501-1000 Kg — 0-10 km lead', unit: 'Per Trip', rate: 4000.0 },
  { desc: 'Carriage 501-1000 Kg — 11-20 km lead', unit: 'Per Trip', rate: 4500.0 },
  { desc: 'Carriage 501-1000 Kg — 21-50 km lead', unit: 'Per Trip', rate: 5000.0 },
  { desc: 'Carriage 501-1000 Kg — 51-100 km lead', unit: 'Per Trip', rate: 6800.0 },
  { desc: 'Carriage 1001-2000 Kg — 0-10 km lead', unit: 'Per Trip', rate: 4500.0 },
  { desc: 'Carriage 1001-2000 Kg — 11-20 km lead', unit: 'Per Trip', rate: 5400.0 },
  { desc: 'Carriage 1001-2000 Kg — 21-50 km lead', unit: 'Per Trip', rate: 7000.0 },
  { desc: 'Carriage 1001-2000 Kg — 51-100 km lead', unit: 'Per Trip', rate: 9500.0 },
];

const HARDWARE_ITEMS = [
  { desc: '100 g Container', unit: 'Per Piece', rate: 74.0 },
  { desc: '250 gm Container', unit: 'Per Piece', rate: 153.0 },
  { desc: '500 gm Container', unit: 'Per Piece', rate: 246.0 },
  { desc: '3 mm thick', unit: 'Per Kg', rate: 118.0 },
  { desc: '6 mm thick', unit: 'Per Kg', rate: 118.0 },
  { desc: 'M-Seal', unit: 'Per Kg', rate: 446.0 },
  { desc: 'Pig Lead 99.99% pure', unit: 'Per Kg', rate: 401.0 },
  { desc: 'Lead Wool Best Quality', unit: 'Per Kg', rate: 212.0 },
  { desc: 'Spun Yarn Best Quality', unit: 'Per Kg', rate: 161.0 },
  { desc: 'Jute Yarn', unit: 'Per Kg', rate: 75.0 },
  { desc: 'Teflon Tape (1 inch wide)', unit: 'Per Piece', rate: 46.0 },
  { desc: 'Steel Wire Rope of 16 mm dia', unit: 'Per Meter', rate: 343.0 },
  { desc: 'Steel Wire Rope Grip Clip for 16 mm dia Steel Wire Rope', unit: 'Per Piece', rate: 23.0 },
  { desc: 'Steel Wire Rope Grip Clip for 16 mm dia Steel Wire Rope', unit: 'Per Piece', rate: 24.0 },
  { desc: 'Steel Wire Rope Lube (IS:2266)', unit: 'Per Kg', rate: 155.0 },
  { desc: 'Repairing of doser pump (inlet, suction line and dosing line), Injector, Foot Valve, Dosing Line, Controller', unit: 'Job', rate: 2500.0 },
  { desc: '200 mm long suitable for 25 mm pipe', unit: 'Per Piece', rate: 367.0 },
  { desc: '250 mm long suitable for 40 mm pipe', unit: 'Per Piece', rate: 476.0 },
  { desc: '300 mm long suitable for 50 mm pipe', unit: 'Per Piece', rate: 642.0 },
  { desc: '350 mm long suitable for 50 mm pipe', unit: 'Per Piece', rate: 955.0 },
  { desc: '450 mm long suitable for 65 mm pipe', unit: 'Per Piece', rate: 1662.0 },
  { desc: '600 mm long suitable for 75 mm pipe', unit: 'Per Piece', rate: 2710.0 },
  { desc: '900 mm long suitable for 125 mm pipe', unit: 'Per Piece', rate: 4428.0 },
  { desc: '1200 mm long suitable for 175 mm pipe', unit: 'Per Piece', rate: 7579.0 },
  { desc: '900 mm long suitable for 100 mm pipe', unit: 'Per Piece', rate: 4060.0 },
  { desc: '1000 mm long suitable for 150 mm pipe', unit: 'Per Piece', rate: 5480.0 },
  { desc: '1200 mm long suitable for 200 mm pipe', unit: 'Per Piece', rate: 7515.0 },
  { desc: '1300 mm long suitable for 250 mm pipe', unit: 'Per Piece', rate: 9258.0 },
  { desc: '1400 mm long suitable for 300 mm pipe', unit: 'Per Piece', rate: 11793.0 },
  { desc: '1585 mm long suitable for 324 mm pipe', unit: 'Per Piece', rate: 14605.0 },
  { desc: '110 mm long', unit: 'Per Piece', rate: 196.0 },
  { desc: '155 mm long', unit: 'Per Piece', rate: 231.0 },
  { desc: '205 mm long', unit: 'Per Piece', rate: 242.0 },
  { desc: '255 mm long', unit: 'Per Piece', rate: 322.0 },
  { desc: '305 mm long', unit: 'Per Piece', rate: 443.0 },
  { desc: '380 mm long', unit: 'Per Piece', rate: 903.0 },
  { desc: '445 mm long', unit: 'Per Piece', rate: 2317.0 },
  { desc: '606 mm long', unit: 'Per Piece', rate: 3772.0 },
  { desc: '780 mm long', unit: 'Per Piece', rate: 14567.0 },
  { desc: 'Electro Fusion PipeMachine for HDPE', unit: 'Per day per Machine', rate: 1000.0 },
  { desc: 'Butt Fusion Welding Machine', unit: 'Per day per Machine', rate: 1000.0 },
  { desc: 'Gas Welding Machine', unit: 'Per day per Machine', rate: 2500.0 },
  { desc: 'Electric Welding Machine', unit: 'Per day per Machine', rate: 1000.0 },
  { desc: 'Jati Bamboo', unit: 'Per Piece', rate: 81.0 },
  { desc: 'Bhaluka Bamboo', unit: 'Per Piece', rate: 127.0 },
  { desc: 'Cotton waste', unit: 'Per Piece', rate: 70.0 },
  { desc: 'Coconut Rope', unit: 'Per Piece', rate: 125.0 },
  { desc: 'Plastic rope', unit: 'Per Piece', rate: 173.0 },
  { desc: 'Jute Rope', unit: 'Per Piece', rate: 200.0 },
  { desc: 'Spun yearn', unit: 'Per Piece', rate: 81.0 },
  { desc: 'Cotton rope', unit: 'Per Piece', rate: 587.0 },
  { desc: 'Coarse sand', unit: 'Per Piece', rate: 1475.0 },
  { desc: 'Fine sand', unit: 'Per Piece', rate: 1265.0 },
  { desc: 'Coarse Aggregate', unit: 'Per Piece', rate: 1725.0 },
  { desc: 'Pea gravel', unit: 'Per Piece', rate: 2300.0 },
  { desc: 'Broken bricks', unit: 'Per Piece', rate: 2760.0 },
  { desc: 'Pine / 2nd class wood (25mm thick)', unit: 'Per Piece', rate: 18752.0 },
  { desc: 'Wire, nails', unit: 'Per Piece', rate: 86.0 },
];


const VALVES_ITEMS = [
      // 
      { desc: '50 mm dia', unit: 'Per Piece', rate: 5782.0 },
      { desc: '65 mm dia', unit: 'Per Piece', rate: 6358.0 },
      { desc: '80 mm dia', unit: 'Per Piece', rate: 7848.0 },
      { desc: '100 mm dia', unit: 'Per Piece', rate: 11274.0 },
      { desc: '125 mm dia', unit: 'Per Piece', rate: 17166.0 },
      { desc: '150 mm dia', unit: 'Per Piece', rate: 21507.0 },
      { desc: '50 mm dia', unit: 'Per Piece', rate: 6875.0 },
      { desc: '65 mm dia', unit: 'Per Piece', rate: 13525.0 },
      { desc: '80 mm dia', unit: 'Per Piece', rate: 16838.0 },
      { desc: '100 mm dia', unit: 'Per Piece', rate: 28875.0 },
      { desc: '50 mm dia', unit: 'Per Piece', rate: 3201.0 },
      { desc: '65 mm dia', unit: 'Per Piece', rate: 3573.0 },
      { desc: '80 mm dia', unit: 'Per Piece', rate: 3303.0 },
      { desc: '50 mm dia', unit: 'Per Piece', rate: 7364.0 },
      { desc: '65 mm dia', unit: 'Per Piece', rate: 11366.0 },
      { desc: '80 mm dia', unit: 'Per Piece', rate: 16850.0 },
      { desc: '100 mm dia', unit: 'Per Piece', rate: 31806.0 },
      { desc: '150 mm dia', unit: 'Per Piece', rate: 105832.0 },
];

const ELECTRICAL_ITEMS = [
      // 
      { desc: 'Repairing and servicing of electrical Panel Starters—designed for Submersible, Centrifugal, and Openwell Submersible Pum', unit: 'Job', rate: 1538.0 },
      { desc: '2 Pole Contactor for single phase upto 2 HP Motor', unit: 'Per Piece', rate: 1666.0 },
      { desc: '4 Pole Contactor for three phase 3 HP to 10 HP DOL Starter(20 Amp)', unit: 'Per Piece', rate: 3295.0 },
      { desc: '4 Pole Contactor for three phase 7.5 HP to 10 HP Star Delta Starter(20 Amp)', unit: 'Per Piece', rate: 3376.0 },
      { desc: 'Housing 2 Pole', unit: 'Per Piece', rate: 869.0 },
      { desc: 'Housing 4 Pole', unit: 'Per Piece', rate: 974.0 },
      { desc: 'Carrier Assembly 2P', unit: 'Per Piece', rate: 92.0 },
      { desc: 'Carrier Assembly 4P', unit: 'Per Piece', rate: 113.0 },
      { desc: '2 Pole Contactor Coil', unit: 'Per Piece', rate: 759.0 },
      { desc: '4 Pole Contactor Coil', unit: 'Per Piece', rate: 764.0 },
      { desc: '2 Pole Single Fixed Contact (20 A)', unit: 'Per Piece', rate: 914.0 },
      { desc: '4 Pole Single Fixed Contact (20 A)', unit: 'Per Piece', rate: 2307.0 },
      { desc: '2 Pole Single Moving Contact (20 A)', unit: 'Per Piece', rate: 179.0 },
      { desc: '4 Pole Single Moving Contact (20 A)', unit: 'Per Piece', rate: 179.0 },
      { desc: 'Contact Kit 2Pole Contactor(20 A)', unit: 'Per Piece', rate: 179.0 },
      { desc: 'Contact Kit 4Pole Contactor(20 A)', unit: 'Per Piece', rate: 179.0 },
      { desc: '2 Pole Thermal Overload Relay for single phase upto 2 HP Starter for 20 A range', unit: 'Per Piece', rate: 1250.0 },
      { desc: '3 Pole Thermal Overload Relay for 4 Pole three phase from 3 HP to 10 HP Starter for 20 A range', unit: 'Per Piece', rate: 2090.0 },
      { desc: 'NO Switch for single Phase upto 2 HP Starter', unit: 'Per Piece', rate: 174.0 },
      { desc: 'ON/OFF Push Button Assembly for single Phase upto 2 HP Starter', unit: 'Per Piece', rate: 381.0 },
      { desc: 'Start (Green)/ Stop(Red) Button Switch for single and three phase starter upto 10 HP', unit: 'Per Piece', rate: 718.0 },
      { desc: 'Motor On (Green)/ Off (Yellow) Indicating Light for single and three phase starter upto 10 HP', unit: 'Per Piece', rate: 718.0 },
      { desc: 'Single Phase Preventor for 3 phase starter', unit: 'Per Piece', rate: 3605.0 },
      { desc: 'Combined Voltmeter and Ammeter for single and three phase starter upto 10 HP', unit: 'Per Piece', rate: 1540.0 },
      { desc: 'Terminal Block 3 way for 3 phase starter', unit: 'Per Piece', rate: 256.0 },
      { desc: 'Terminal Block 6 way for 3 phase starter', unit: 'Per Piece', rate: 494.0 },
      { desc: 'Terminal Block 2 way SPSS for single phase starter upto 2 HP', unit: 'Per Piece', rate: 118.0 },
      { desc: 'Terminal Block 5 way for single phase starter upto 2 HP', unit: 'Per Piece', rate: 244.0 },
      { desc: 'RYB Voltage Selector Switch for 3 phase starter', unit: 'Per Piece', rate: 402.0 },
      { desc: 'Timer Relay for 3 phase Star Delta starter upto 10 HP', unit: 'Per Piece', rate: 3195.0 },
      { desc: 'Front Add On Auxillary Contact Block for single phase starter upto 2 HP', unit: 'Per Piece', rate: 1275.0 },
      { desc: 'Front Add On Auxillary Contact Block for three phase starter upto 10 HP', unit: 'Per Piece', rate: 1585.0 },
      { desc: 'Mini Rocker Switch - SPP By Pass for three phase starter upto 10 HP', unit: 'Per Piece', rate: 350.0 },
      { desc: 'Copper Strip', unit: 'Per Kg', rate: 103.0 },
      { desc: 'Panel Screw', unit: 'Per Piece', rate: 103.0 },
      { desc: 'Start Capacitor', unit: 'Per Piece', rate: 431.0 },
      { desc: '0.5 to 5 AMP SP MCB for single phase motor', unit: 'Per Piece', rate: 492.0 },
      { desc: '6 to 32 AMP SP MCB for single phase motor', unit: 'Per Piece', rate: 294.0 },
      { desc: '40 AMP SP MCB for single phase motor', unit: 'Per Piece', rate: 687.0 },
      { desc: '0.5 to 5 AMP SPN MCB for single phase motor', unit: 'Per Piece', rate: 1205.0 },
      { desc: '6 to 32 AMP SPN MCB for single phase motor', unit: 'Per Piece', rate: 970.0 },
      { desc: '40 AMP SPN MCB for single phase motor', unit: 'Per Piece', rate: 1562.0 },
      { desc: '0.5 to 5 AMP DP MCB for single phase motor', unit: 'Per Piece', rate: 1355.0 },
      { desc: '6 to 32 AMP DP MCB for single phase motor', unit: 'Per Piece', rate: 1280.0 },
      { desc: '40 AMP DP MCB for single phase motor', unit: 'Per Piece', rate: 1565.0 },
      { desc: '0.5 to 5 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 1891.0 },
      { desc: '6 to 32 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 1530.0 },
      { desc: '40 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2360.0 },
      { desc: '50 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2360.0 },
      { desc: '63 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2425.0 },
      { desc: '0.5 to 5 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2480.0 },
      { desc: '6 to 32 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2095.0 },
      { desc: '40 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2956.0 },
      { desc: '50 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2970.0 },
      { desc: '63 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2970.0 },
      { desc: '0.5 to 5 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2544.0 },
      { desc: '6 to 32 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2095.0 },
      { desc: '40 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2970.0 },
      { desc: '50 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2970.0 },
      { desc: '63 AMP TP MCB for Three phase motor', unit: 'Per Piece', rate: 2970.0 },
  // ... 68 more items in full SOR
];

const SUBMERSIBLE_ITEMS = [
      // 
      { desc: 'Submersible pump-motor for upto 2 HP Single Phase Motor', unit: 'Job', rate: 6919.0 },
      { desc: 'Submersible pump-motor of 3  HP Three Phase Motor', unit: 'Job', rate: 8969.0 },
      { desc: 'Submersible pump-motor of  5 HP Three Phase Motor', unit: 'Job', rate: 8969.0 },
      { desc: 'Submersible pump-motor of 7.5  HP Three Phase Motor', unit: 'Job', rate: 12300.0 },
      { desc: 'Submersible pump-motor of 10 HP Three Phase Motor', unit: 'Job', rate: 12300.0 },
      { desc: 'Mechanic/Servicing Charges for repair for upto 2 HP Single Phase Submersible Pumpset', unit: 'Job', rate: 2500.0 },
      { desc: 'Mechanic/Servicing Charges for repair of 3  HP Three Phase Submersible Pumpset', unit: 'Job', rate: 3500.0 },
      { desc: 'Mechanic/Servicing Charges for repair of  5 HP Three Phase Submersible Pumpset', unit: 'Job', rate: 3500.0 },
      { desc: 'Mechanic/Servicing Charges for repair of 7.5  HP Three Phase Submersible Pumpset', unit: 'Job', rate: 4500.0 },
      { desc: 'Mechanic/Servicing Charges for repair of 10 HP Three Phase Submersible Pumpset', unit: 'Job', rate: 4500.0 },
      { desc: 'Rewinding of the Stator for upto 2 HP Single Phase Motor', unit: 'Job', rate: 5500.0 },
      { desc: 'Rewinding of the Stator for 3 HP Three Phase Submersible Motor', unit: 'Job', rate: 6800.0 },
      { desc: 'Rewinding of the Stator for 5 HP Three Phase Submersible Motor', unit: 'Job', rate: 8500.0 },
      { desc: 'Rewinding of the Stator for 7.5 HP Three Phase Submersible Motor', unit: 'Job', rate: 10000.0 },
      { desc: 'Rewinding of the Stator for 10 HP Three Phase Submersible Motor', unit: 'Job', rate: 12500.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for upto 2 HP Single Phase Motor', unit: 'Job', rate: 1785.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 3 HP Three Phase Motor', unit: 'Job', rate: 2113.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 5 HP Three Phase Motor', unit: 'Job', rate: 3374.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 7.5 HP Three Phase Motor', unit: 'Job', rate: 3375.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 10 HP Three Phase Motor', unit: 'Job', rate: 4424.0 },
      { desc: 'Bowel for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 222.0 },
      { desc: 'Bowel for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 322.0 },
      { desc: 'Bowel for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 322.0 },
      { desc: 'Bowel for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 515.0 },
      { desc: 'Bowel for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 515.0 },
      { desc: 'Center Bowel for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 1384.0 },
      { desc: 'Center Bowel for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 1384.0 },
      { desc: 'Center Bowel for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 1384.0 },
      { desc: 'Center Bowel for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 1691.0 },
      { desc: 'Center Bowel for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 1691.0 },
      { desc: 'Upper Bowel Set for upto 2 HP Single Phase Motor', unit: 'Per Set', rate: 1691.0 },
      { desc: 'Upper Bowel Set for 3 HP Three Phase Motor', unit: 'Per Set', rate: 1691.0 },
      { desc: 'Upper Bowel Set for 5 HP Three Phase Motor', unit: 'Per Set', rate: 1691.0 },
      { desc: 'Upper Bowel Set for 7.5HP Three Phase Motor', unit: 'Per Set', rate: 1999.0 },
      { desc: 'Upper Bowel Set for 10 HP Three Phase Motor', unit: 'Per Set', rate: 1999.0 },
      { desc: 'Lower Bowel Set for upto 2 HP Single Phase Motor', unit: 'Per Set', rate: 482.0 },
      { desc: 'Lower Bowel Set for 3 HP Three Phase Motor', unit: 'Per Set', rate: 774.0 },
      { desc: 'Lower Bowel Set for 5 HP Three Phase Motor', unit: 'Per Set', rate: 774.0 },
      { desc: 'Lower Bowel Set for 7.5HP Three Phase Motor', unit: 'Per Set', rate: 974.0 },
      { desc: 'Lower Bowel Set for 10 HP Three Phase Motor', unit: 'Per Set', rate: 974.0 },
      { desc: 'Steel Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 269.0 },
      { desc: 'Steel Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 532.0 },
      { desc: 'Steel Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 532.0 },
      { desc: 'Steel Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 699.0 },
      { desc: 'Steel Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 699.0 },
      { desc: 'Brass Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 527.0 },
      { desc: 'Brass Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 731.0 },
      { desc: 'Brass Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 731.0 },
      { desc: 'Brass Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 731.0 },
      { desc: 'Brass Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 731.0 },
      { desc: 'Rubber Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 174.0 },
      { desc: 'Rubber Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 185.0 },
      { desc: 'Rubber Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 185.0 },
      { desc: 'Rubber Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 205.0 },
      { desc: 'Rubber Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 205.0 },
      { desc: 'Journal Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 704.0 },
      { desc: 'Journal Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 807.0 },
      { desc: 'Journal Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 807.0 },
      { desc: 'Journal Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 986.0 },
      { desc: 'Journal Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 986.0 },
      { desc: 'Carbon Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 612.0 },
      { desc: 'Carbon Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 823.0 },
      { desc: 'Carbon Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 823.0 },
      { desc: 'Carbon Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 892.0 },
      { desc: 'Carbon Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 892.0 },
      { desc: 'Oil Seal Bush for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 72.0 },
      { desc: 'Oil Seal Bush for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 123.0 },
      { desc: 'Oil Seal Bush for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 123.0 },
      { desc: 'Oil Seal Bush for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 144.0 },
      { desc: 'Oil Seal Bush for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 144.0 },
      { desc: 'Bracket Top or Adapter with Non Return Valve(Pump Side) for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 1640.0 },
      { desc: 'Bracket Top or Adapter with Non Return Valve(Pump Side) for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 1896.0 },
      { desc: 'Bracket Top or Adapter with Non Return Valve(Pump Side) for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 1896.0 },
      { desc: 'Bracket Top or Adapter with Non Return Valve(Pump Side) for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 2798.0 },
      { desc: 'Bracket Top or Adapter with Non Return Valve(Pump Side) for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 2798.0 },
      { desc: 'Lower Bracket/Adpater (Pump Side with Strainer) for upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 1333.0 },
      { desc: 'Lower Bracket/Adpater (Pump Side with Strainer) for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 2798.0 },
      { desc: 'Lower Bracket/Adpater (Pump Side with Strainer) for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 2798.0 },
      { desc: 'Lower Bracket/Adpater (Pump Side with Strainer) for 7.5HP Three Phase Motor', unit: 'Per Piece', rate: 4415.0 },
      { desc: 'Lower Bracket/Adpater (Pump Side with Strainer) for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 4415.0 },
  // ... 147 more items in full SOR
];

const CENTRIFUGAL_ITEMS = [
      // 
      { desc: 'Lifting and removal of an existing centrifugal pump set (comprising the pump and motor) from its foundation or base fram', unit: 'Job', rate: 6919.0 },
      { desc: 'Mechanic/Servicing Charge for repair of Mono Block Centrifugal motor and pumpset upto 2 HP SIngle Phase Motor', unit: 'Job', rate: 1500.0 },
      { desc: 'Mechanic/Servicing Charge for repair of Mono Block Centrifugal motor and pumpset for 3 HP Three Phase Motor', unit: 'Job', rate: 2000.0 },
      { desc: 'Mechanic/Servicing Charge for repair of Mono Block Centrifugal motor and pumpset for 5 HP Three Phase Motor', unit: 'Job', rate: 2000.0 },
      { desc: 'Mechanic/Servicing Charge for repair of Mono Block Centrifugal motor and pumpset for 7.5 HP Three Phase Motor', unit: 'Job', rate: 5000.0 },
      { desc: 'Mechanic/Servicing Charge for repair of Mono Block Centrifugal motor and pumpset for 10 HP Three Phase Motor', unit: 'Job', rate: 5000.0 },
      { desc: 'Rewinding with Enamel Copper Wire upto 2 HP Single Phase Motor', unit: 'Job', rate: 4500.0 },
      { desc: 'Rewinding with Enamel Copper Wire for 3 HP Three Phase Motor', unit: 'Job', rate: 6500.0 },
      { desc: 'Rewinding with Enamel Copper Wire for 5 HP Three Phase Motor', unit: 'Job', rate: 7800.0 },
      { desc: 'Rewinding with Enamel Copper Wire for 7.5 HP Three Phase Motor', unit: 'Job', rate: 9500.0 },
      { desc: 'Rewinding with Enamel Copper Wire for 10 HP Three Phase Motor', unit: 'Job', rate: 12000.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) upto 2 HP Single Phase Motor', unit: 'Job', rate: 1076.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 3 HP Three Phase Motor', unit: 'Job', rate: 1400.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 5 HP Three Phase Motor', unit: 'Job', rate: 1890.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 7.5 HP Three Phase Motor', unit: 'Job', rate: 2205.0 },
      { desc: 'Rotor Shaft (For welding and turning for the Lathe Machine) for 10 HP Three Phase Motor', unit: 'Job', rate: 2625.0 },
      { desc: 'CI Impeller upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 1200.0 },
      { desc: 'CI Impeller for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 1640.0 },
      { desc: 'CI Impeller for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 1640.0 },
      { desc: 'CI Impeller for 7.5  HP Three Phase Motor', unit: 'Per Piece', rate: 2563.0 },
      { desc: 'CI Impeller for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 2563.0 },
      { desc: 'Brass Impeller upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 6078.0 },
      { desc: 'Brass Impeller for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 10178.0 },
      { desc: 'Brass Impeller for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 10178.0 },
      { desc: 'Brass Impeller for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 10898.0 },
      { desc: 'Brass Impeller for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 10898.0 },
      { desc: 'Noryl or Plastic Impeller upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 769.0 },
      { desc: 'Noryl or Plastic Impeller for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 974.0 },
      { desc: 'Noryl or Plastic Impeller for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 974.0 },
      { desc: 'Noryl or Plastic Impeller for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 1281.0 },
      { desc: 'Noryl or Plastic Impeller for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 1281.0 },
      { desc: 'SS Impeller upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 2563.0 },
      { desc: 'SS Impeller for for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 3588.0 },
      { desc: 'SS Impeller for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 3588.0 },
      { desc: 'SS Impeller for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 4613.0 },
      { desc: 'SS Impeller for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 4613.0 },
      { desc: 'Replacement of Pump Valuit Casing upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 1640.0 },
      { desc: 'Replacement of Pump Valuit Casing for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 2255.0 },
      { desc: 'Replacement of Pump Valuit Casing for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 2255.0 },
      { desc: 'Replacement of Pump Valuit Casing for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 3116.0 },
      { desc: 'Replacement of Pump Valuit Casing for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 3116.0 },
      { desc: 'Glend Flange upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 368.0 },
      { desc: 'Glend Flange for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 461.0 },
      { desc: 'Glend Flange for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 461.0 },
      { desc: 'Glend Flange for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 743.0 },
      { desc: 'Glend Flange for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 743.0 },
      { desc: 'Glend Packing upto 2 HP Single Phase Motor', unit: 'Per Kg', rate: 210.0 },
      { desc: 'Glend Packing for 3 HP Three Phase Motor', unit: 'Per Kg', rate: 179.0 },
      { desc: 'Glend Packing for 5 HP Three Phase Motor', unit: 'Per Kg', rate: 179.0 },
      { desc: 'Glend Packing for 7.5 HP Three Phase Motor', unit: 'Per Kg', rate: 224.0 },
      { desc: 'Glend Packing for 10 HP Three Phase Motor', unit: 'Per Kg', rate: 224.0 },
      { desc: 'Body Gasket upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 112.0 },
      { desc: 'Body Gasket for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 115.0 },
      { desc: 'Body Gasket for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 115.0 },
      { desc: 'Body Gasket for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 120.0 },
      { desc: 'Body Gasket for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 120.0 },
      { desc: 'Studs Bolt and Nuts upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 188.0 },
      { desc: 'Studs Bolt and Nuts for for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 251.0 },
      { desc: 'Studs Bolt and Nuts for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 251.0 },
      { desc: 'Studs Bolt and Nuts for for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 309.0 },
      { desc: 'Studs Bolt and Nuts for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 309.0 },
      { desc: 'Impeller Check Nuts upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 154.0 },
      { desc: 'Impeller Check Nuts for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 169.0 },
      { desc: 'Impeller Check Nuts for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 169.0 },
      { desc: 'Impeller Check Nuts for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 179.0 },
      { desc: 'Impeller Check Nuts for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 179.0 },
      { desc: 'Pump Shaft Sleeve upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 615.0 },
      { desc: 'Pump Shaft Sleeve for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 550.0 },
      { desc: 'Pump Shaft Sleeve for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 550.0 },
      { desc: 'Pump Shaft Sleeve for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 615.0 },
      { desc: 'Pump Shaft Sleeve for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 615.0 },
      { desc: 'Flange (Delivery Side) upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 390.0 },
      { desc: 'Flange (Delivery Side) for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 490.0 },
      { desc: 'Flange (Delivery Side) for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 490.0 },
      { desc: 'Flange (Delivery Side) for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 590.0 },
      { desc: 'Flange (Delivery Side) for 10 HP Three Phase Motor', unit: 'Per Piece', rate: 590.0 },
      { desc: 'Flange (Suction Side) upto 2 HP Single Phase Motor', unit: 'Per Piece', rate: 390.0 },
      { desc: 'Flange (Suction Side) for 3 HP Three Phase Motor', unit: 'Per Piece', rate: 490.0 },
      { desc: 'Flange (Suction Side) for 5 HP Three Phase Motor', unit: 'Per Piece', rate: 490.0 },
      { desc: 'Flange (Suction Side) for 7.5 HP Three Phase Motor', unit: 'Per Piece', rate: 600.0 },
  // ... 121 more items in full SOR
];

const ESR_ITEMS = [
      { desc: 'Providing and applying anti-corrosive painting over thel metal surfaces of Elevated Service Reservoirs (ESRs)', unit: 'Per Sq M', rate: 105.0 },
];

// ── Derived lookup helpers ────────────────────────────────────
const PIPE_DIMS = Object.fromEntries(
  PIPE_TYPES.map(t => [t, (PIPE_CATALOGUE[t]?.pipes||[]).map(p => p.desc)])
);
const PIPE_RATES = Object.fromEntries(
  PIPE_TYPES.map(t => [t, Object.fromEntries(
    (PIPE_CATALOGUE[t]?.pipes||[]).map(p => [p.desc, p.rate])
  )])
);
const PIPE_FITTINGS = Object.fromEntries(
  PIPE_TYPES.map(t => [t, PIPE_CATALOGUE[t]?.fittings||[]])
);

// ── Render Engine ─────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  if (STATE.currentStep === -1) {
    app.appendChild(renderLogin());
  } else {
    app.appendChild(renderShell());
  }

  createToastContainer();
}

// ── LOGIN ─────────────────────────────────────────────────────
function renderLogin() {
  const screen = el('div', 'login-screen');
  screen.innerHTML = `
    <div class="login-bg-deco"></div>
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo-icon">💧</div>
        <div>
          <div class="login-logo-text">PHE Department</div>
          <div class="login-logo-sub">Govt. Water Supply System</div>
        </div>
      </div>
      <h1 class="login-title">Cost Estimation<br>Portal</h1>
      <p class="login-subtitle">Secure multi-role access for authorised officials</p>

      <div class="form-group">
        <label class="form-label">Role <span class="required">*</span></label>
        <select class="form-control" id="login-role">
          <option value="">— Select Role —</option>
          <option value="SO">SO (Sectional Officer)</option>
          <option value="SDO">SDO (Sub-Divisional Officer)</option>
          <option value="EE">EE (Executive Engineer)</option>
          <option value="SE">SE (Superintending Engineer)</option>
          <option value="HQ">HQ (Head Quarter)</option>
        </select>
        <div class="form-error">Please select your role</div>
      </div>

      <div class="form-group">
        <label class="form-label">Username <span class="required">*</span></label>
        <div class="input-with-icon">
          <span class="input-icon">👤</span>
          <input type="text" id="login-user" class="form-control" placeholder="Enter your username"/>
        </div>
        <div class="form-error">Username is required</div>
      </div>

      <div class="form-group">
        <label class="form-label">Password <span class="required">*</span></label>
        <div class="input-with-icon">
          <span class="input-icon">🔒</span>
          <input type="password" id="login-pass" class="form-control" placeholder="Enter your password"/>
          <button class="password-toggle" id="toggle-pass" type="button" title="Show/hide password">👁️</button>
        </div>
        <div class="form-error">Password is required</div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-bottom:0.5rem">
        <button class="theme-toggle" id="login-theme-toggle" title="Toggle theme">
          <div class="theme-toggle-track"><div class="theme-toggle-thumb"></div></div>
          <span class="theme-toggle-icon">${document.documentElement.getAttribute('data-theme')==='dark'?'🌙':'☀️'}</span>
          <span class="theme-toggle-label">${document.documentElement.getAttribute('data-theme')==='dark'?'Dark':'Light'}</span>
        </button>
      </div>
      <div class="login-divider">Secure Login</div>

      <button class="btn btn-primary btn-lg btn-full" id="login-btn">
        <span>Sign In</span> <span>→</span>
      </button>

      <p style="margin-top:1.25rem;font-size:0.75rem;color:var(--text-muted);text-align:center;">
        Demo: any username/password | All roles accepted
      </p>
    </div>
  `;

  // Theme toggle on login screen
  screen.querySelector('#login-theme-toggle')?.addEventListener('click', toggleTheme);

  // Toggle password
  screen.querySelector('#toggle-pass').addEventListener('click', () => {
    const inp = screen.querySelector('#login-pass');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Login action
  screen.querySelector('#login-btn').addEventListener('click', () => {
    const role = screen.querySelector('#login-role');
    const user = screen.querySelector('#login-user');
    const pass = screen.querySelector('#login-pass');
    const ok = validate([
      { el: role, msg: 'Please select your role' },
      { el: user, msg: 'Username is required' },
      { el: pass, msg: 'Password is required' },
    ]);
    if (!ok) return;

    const btn = screen.querySelector('#login-btn');
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    btn.disabled = true;

    setTimeout(() => {
      STATE.user = { role: role.value, username: user.value };
      STATE.currentStep = 0;
      saveState();
      render();
      showToast(`Welcome, ${user.value} (${role.value})!`);
    }, 900);
  });

  return screen;
}

// ── SHELL (header + stepper + content + footer) ───────────────
function renderShell() {
  const shell = el('div', 'app-shell');

  // Header
  shell.appendChild(renderHeader());

  // Stepper
  shell.appendChild(renderStepper());

  // Content
  const content = el('div', 'content-area page-enter');
  content.appendChild(renderStep(STATE.currentStep));
  shell.appendChild(content);

  // Footer nav
  shell.appendChild(renderNavFooter());

  return shell;
}

function renderHeader() {
  const h = el('header', 'app-header');
  h.innerHTML = `
    <div class="header-brand">
      <div class="header-logo">💧</div>
      <div>
        <div class="header-brand-text">PHE Cost Estimation</div>
        <div class="header-brand-sub">Public Health Engineering Dept.</div>
      </div>
    </div>
    <div class="header-user">
      <div class="header-user-badge">
        <span class="badge-role">${STATE.user?.role}</span>
        <span>${STATE.user?.username}</span>
      </div>
      <button class="theme-toggle" id="theme-toggle-btn" title="Toggle light/dark mode">
        <div class="theme-toggle-track"><div class="theme-toggle-thumb"></div></div>
        <span class="theme-toggle-icon">${document.documentElement.getAttribute('data-theme')==='dark'?'🌙':'☀️'}</span>
        <span class="theme-toggle-label">${document.documentElement.getAttribute('data-theme')==='dark'?'Dark':'Light'}</span>
      </button>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
    </div>
  `;
  h.querySelector('#logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout? Unsaved data will be lost.')) {
      localStorage.removeItem('phe_estimation_state');
      STATE.user = null; STATE.currentStep = -1;
      render();
    }
  });
  h.querySelector('#theme-toggle-btn')?.addEventListener('click', toggleTheme);
  return h;
}

function renderStepper() {
  STEPS = buildSteps();
  const w = el('div', 'stepper-wrapper');
  const s = el('div', 'stepper');

  STEPS.forEach((step, i) => {
    const done   = i < STATE.currentStep;
    const active = i === STATE.currentStep;

    const item = el('div', `step-item${active?' active':''}${done?' done':''}`);
    item.innerHTML = `
      <div class="step-circle ${active?'active':''} ${done?'done':''}">
        ${done ? '✓' : (i+1)}
      </div>
      <div class="step-info">
        <div class="step-num">Step ${i+1}</div>
        <div class="step-name">${step.name}</div>
      </div>
    `;
    s.appendChild(item);

    if (i < STEPS.length - 1) {
      const line = el('div', `step-line${done?' done':''}`);
      s.appendChild(line);
    }
  });

  w.appendChild(s);
  return w;
}

function renderNavFooter() {
  STEPS = buildSteps();
  const f = el('div', 'nav-footer');
  const step = STATE.currentStep;
  const total = STEPS.length;

  f.innerHTML = `
    <div class="flex gap-2">
      <button class="btn btn-ghost" id="nav-prev" ${step === 0 ? 'disabled' : ''}>← Previous</button>
    </div>
    <div class="nav-footer-progress">Step <span>${step+1}</span> of ${total}</div>
    <div class="flex gap-2">
      ${step === total - 1
        ? `<button class="btn btn-accent btn-lg" id="nav-submit">🎉 Submit Estimate</button>`
        : `<button class="btn btn-primary" id="nav-next">Next →</button>`
      }
    </div>
  `;

  f.querySelector('#nav-prev')?.addEventListener('click', () => {
    if (step > 0) { STATE.currentStep--; saveState(); render(); window.scrollTo(0,0); }
  });

  f.querySelector('#nav-next')?.addEventListener('click', () => {
    if (validateStep(step)) {
      // After components step, rebuild steps so flow adapts
      if (STEPS[step]?.key === 'components') {
        STEPS = buildSteps();
      }
      const newStep = step + 1;
      STATE.currentStep = Math.min(newStep, buildSteps().length - 1);
      saveState(); render(); window.scrollTo(0,0);
    }
  });

  f.querySelector('#nav-submit')?.addEventListener('click', () => {
    showToast('Estimate submitted successfully! Generating PDF…', 'success');
    setTimeout(() => window.print(), 800);
  });

  return f;
}

// ── Step validators ───────────────────────────────────────────
function validateStep(step) {
  switch(step) {
    case 0: return validateScheme();
    case 1: return validateIncident();
    default: return true;
  }
}

function validateScheme() {
  const required = ['zone','circle','district','division','scheme_name','imis_id'];
  let ok = true;
  required.forEach(id => {
    const el = document.getElementById(`s-${id}`);
    if (!el) return;
    const errEl = el.closest('.form-group')?.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) { errEl.textContent = 'This field is required'; errEl.classList.add('visible'); }
      ok = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });
  if (!ok) showToast('Please fill all required fields', 'error');
  return ok;
}

function validateIncident() {
  const d = document.getElementById('incident-date');
  if (!d.value) {
    d.classList.add('error');
    showToast('Please select the incident date', 'error');
    return false;
  }
  return true;
}

// ── STEP RENDERERS ────────────────────────────────────────────
function renderStep(stepIndex) {
  STEPS = buildSteps(); // always fresh
  const step = STEPS[stepIndex];
  if (!step) return el('div','','Unknown step');
  const renderer = STEP_RENDERERS[step.key];
  return renderer ? renderer() : el('div','',`Step "${step.key}" not implemented`);
}

// ── Generic Item Step (Valves, Submersible, Centrifugal, Electrical, ESR) ──
function renderGenericItemStep(title, subtitle, icon, presetItems, stateKey) {
  if (!STATE[stateKey]) STATE[stateKey] = [];
  const wrap = el('div');

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${title}</h1>
      <p class="page-subtitle">${subtitle}</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">${icon}</div> Items</div>
        <span class="badge badge-blue" id="gen-count">${STATE[stateKey].length} entries</span>
      </div>
      <div id="gen-rows"></div>
      <button class="add-row-btn" id="add-gen-row">＋ Add Entry</button>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">💰</div> Sub-Total</div>
      </div>
      <div class="table-wrapper" id="gen-summary"></div>
    </div>
  `;

  const renderSummary = () => {
    const el2 = wrap.querySelector('#gen-summary');
    if (!STATE[stateKey].length) { el2.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No entries yet.</p>'; return; }
    const total = STATE[stateKey].reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
    el2.innerHTML = `<table>
      <thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>${STATE[stateKey].map((it,i)=>`<tr>
        <td>${i+1}</td>
        <td style="font-size:0.8rem">${it.desc||'—'}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${it.unit||''}</td>
        <td class="table-number">${fmt(it.rate)}</td>
        <td class="table-number">${it.qty||0}</td>
        <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">Sub-Total</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>`;
  };

  const renderRows = () => {
    const container = wrap.querySelector('#gen-rows');
    container.innerHTML = '';
    wrap.querySelector('#gen-count').textContent = STATE[stateKey].length + ' entries';
    STATE[stateKey].forEach((item,i) => {
      const row = el('div','item-row');
      row.style.gridTemplateColumns = '3fr 120px 100px auto auto';
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Description</label>
          <select class="form-control gen-desc" data-i="${i}">
            <option value="">— Select item —</option>
            ${presetItems.map(p=>`<option ${item.desc===p.desc?'selected':''} value="${p.desc}" data-rate="${p.rate}" data-unit="${p.unit}">${p.desc.substring(0,90)}</option>`).join('')}
            <option value="__custom__" ${item.desc==='__custom__'?'selected':''}>Custom…</option>
          </select>
        </div>
        ${item.desc==='__custom__'?`<div class="form-group" style="margin:0">
          <label class="form-label">Custom Name</label>
          <input type="text" class="form-control gen-custom" data-i="${i}" value="${item.customName||''}" placeholder="Item name"/>
        </div>`:''}
        <div class="form-group" style="margin:0">
          <label class="form-label">Rate (₹)</label>
          <input type="number" class="form-control gen-rate" data-i="${i}" min="0" value="${item.rate||''}" placeholder="0"/>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Qty</label>
          <input type="number" class="form-control gen-qty" data-i="${i}" min="0" value="${item.qty||''}" placeholder="0"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt((item.rate||0)*(item.qty||0))}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon gen-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.gen-desc').forEach(sel=>{
      sel.addEventListener('change',()=>{
        const i=+sel.dataset.i; const opt=sel.options[sel.selectedIndex];
        STATE[stateKey][i].desc=sel.value;
        if(sel.value!=='__custom__'){STATE[stateKey][i].rate=+opt.dataset.rate||0; STATE[stateKey][i].unit=opt.dataset.unit||'';}
        STATE[stateKey][i].cost=(STATE[stateKey][i].rate||0)*(STATE[stateKey][i].qty||0);
        saveState(); renderRows(); renderSummary();
      });
    });
    container.querySelectorAll('.gen-custom').forEach(inp=>{
      inp.addEventListener('input',()=>{STATE[stateKey][+inp.dataset.i].customName=inp.value; saveState();});
    });
    container.querySelectorAll('.gen-rate').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const i=+inp.dataset.i; STATE[stateKey][i].rate=+inp.value;
        STATE[stateKey][i].cost=(STATE[stateKey][i].rate||0)*(STATE[stateKey][i].qty||0);
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent=fmt(STATE[stateKey][i].cost);
        saveState(); renderSummary();
      });
    });
    container.querySelectorAll('.gen-qty').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const i=+inp.dataset.i; STATE[stateKey][i].qty=+inp.value;
        STATE[stateKey][i].cost=(STATE[stateKey][i].rate||0)*(STATE[stateKey][i].qty||0);
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent=fmt(STATE[stateKey][i].cost);
        saveState(); renderSummary();
      });
    });
    container.querySelectorAll('.gen-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        STATE[stateKey].splice(+btn.dataset.i,1); saveState(); renderRows(); renderSummary();
      });
    });
  };

  wrap.querySelector('#add-gen-row').addEventListener('click',()=>{
    STATE[stateKey].push({desc:'',rate:0,qty:0,cost:0,unit:''});
    saveState(); renderRows(); renderSummary();
  });

  renderRows(); renderSummary();
  return wrap;
}

// ── Coming Soon Step ─────────────────────────────────────────
function renderStepComingSoon(name, icon) {
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${icon} ${name}</h1>
      <p class="page-subtitle">This component section is under development</p>
    </div>
    <div class="card" style="text-align:center;padding:3rem 2rem">
      <div style="font-size:4rem;margin-bottom:1rem">${icon}</div>
      <h2 style="font-size:1.3rem;color:var(--text-primary);margin-bottom:0.5rem">${name}</h2>
      <p style="color:var(--text-muted);font-size:0.9rem;max-width:420px;margin:0 auto 1.5rem">
        Rate data and entry forms for <strong style="color:var(--text-secondary)">${name}</strong> 
        are being prepared and will be available in the next update.
      </p>
      <div style="display:inline-flex;align-items:center;gap:0.5rem;background:var(--accent-glow);border:1px solid rgba(245,166,35,0.2);border-radius:20px;padding:0.5rem 1.25rem;color:var(--accent);font-size:0.82rem;font-weight:600">
        🚧 Coming Soon — We will update this section
      </div>
      <div style="margin-top:2rem;font-size:0.78rem;color:var(--text-muted)">
        You can continue to the next step or go back to select different components.
      </div>
    </div>
  `;
  return wrap;
}

// ── Step 0: Scheme Details ────────────────────────────────────
function renderStepScheme() {
  const wrap = el('div');
  const sd = STATE.schemeDetails;

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🏛️ Scheme Details</h1>
      <p class="page-subtitle">Enter administrative & scheme information for the cost estimate</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📍</div> Administrative Location</div>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Zone <span class="required">*</span></label>
          <select id="s-zone" class="form-control">
            <option value="">Select Zone</option>
            ${[' Barak valley Zone','Bodoland Territory Autonomous District','DHAC(Haflong) Zone','Karbi Anglong Autonomous Council','Lower Assam Zone', 'North Assam Zone', 'Upper Assam Zone'].map(z=>`<option ${sd.zone===z?'selected':''} value="${z}">${z}</option>`).join('')}
          </select>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Circle <span class="required">*</span></label>
          <input type="text" id="s-circle" class="form-control" placeholder="e.g. Dima Hasao Circle" value="${sd.circle||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">District <span class="required">*</span></label>
          <input type="text" id="s-district" class="form-control" placeholder="e.g. Dima Hasao" value="${sd.district||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Division <span class="required">*</span></label>
          <input type="text" id="s-division" class="form-control" placeholder="e.g. Umrangso Division" value="${sd.division||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Subdivision</label>
          <input type="text" id="s-subdivision" class="form-control" placeholder="e.g. Diyungbra MAC Area" value="${sd.subdivision||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Block</label>
          <input type="text" id="s-block" class="form-control" placeholder="e.g. Umrangso Block" value="${sd.block||''}"/>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Scheme Information</div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Gram Panchayat</label>
          <input type="text" id="s-panchayat" class="form-control" placeholder="Enter panchayat name" value="${sd.panchayat||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Scheme Name <span class="required">*</span></label>
          <input type="text" id="s-scheme_name" class="form-control" placeholder="e.g. Baraima PWSS" value="${sd.scheme_name||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">IMIS ID <span class="required">*</span></label>
          <input type="text" id="s-imis_id" class="form-control" placeholder="e.g. AS-123456" value="${sd.imis_id||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Number of FHTC</label>
          <input type="number" id="s-fhtc" class="form-control" placeholder="e.g. 250" min="0" value="${sd.fhtc||''}"/>
        </div>
      </div>
    </div>
  `;

  // Auto-save on change
  wrap.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.id.replace('s-', '');
      STATE.schemeDetails[key] = el.value;
      saveState();
    });
  });

  return wrap;
}

// ── Step 1: Incident Date ─────────────────────────────────────
function renderStepIncident() {
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📅 Incident Reporting</h1>
      <p class="page-subtitle">Log the incident date for this repair/replacement work</p>
    </div>

    <div class="card" style="max-width:480px">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Incident Information</div>
      </div>

      <div class="form-group">
        <label class="form-label">Date of Incident Reporting <span class="required">*</span></label>
        <input type="date" id="incident-date" class="form-control" value="${STATE.incidentDate||''}"/>
        <div class="form-error">Please select the incident date</div>
      </div>

      <div class="form-group">
        <label class="form-label">Nature of Complaint</label>
        <select class="form-control" id="incident-nature">
          <option value="">Select nature</option>
          <option ${STATE.incidentNature==='Pipeline Burst'?'selected':''}>Pipeline Burst</option>
          <option ${STATE.incidentNature==='Leakage'?'selected':''}>Leakage</option>
          <option ${STATE.incidentNature==='No Water Supply'?'selected':''}>No Water Supply</option>
          <option ${STATE.incidentNature==='Pump Failure'?'selected':''}>Pump Failure</option>
          <option ${STATE.incidentNature==='Contamination'?'selected':''}>Contamination</option>
          <option ${STATE.incidentNature==='Routine Maintenance'?'selected':''}>Routine Maintenance</option>
          <option ${STATE.incidentNature==='Annual Maintenance'?'selected':''}>Annual Maintenance</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Brief Description</label>
        <textarea class="form-control" id="incident-desc" rows="3" placeholder="Describe the issue briefly…" style="resize:vertical">${STATE.incidentDesc||''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Priority Level</label>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${['Urgent','High','Normal','Low'].map(p=>`
            <label style="cursor:pointer;display:flex;align-items:center;gap:0.3rem;font-size:0.82rem">
              <input type="radio" name="priority" value="${p}" ${STATE.incidentPriority===p?'checked':''} style="accent-color:var(--blue)"/>
              ${p}
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#incident-date').addEventListener('change', e => {
    STATE.incidentDate = e.target.value; saveState();
  });
  wrap.querySelector('#incident-nature').addEventListener('change', e => {
    STATE.incidentNature = e.target.value; saveState();
  });
  wrap.querySelector('#incident-desc').addEventListener('input', e => {
    STATE.incidentDesc = e.target.value; saveState();
  });
  wrap.querySelectorAll('[name="priority"]').forEach(r => {
    r.addEventListener('change', e => { STATE.incidentPriority = e.target.value; saveState(); });
  });

  return wrap;
}

// ── Step 2: Components ────────────────────────────────────────
function renderStepComponents() {
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🧩 Select Components</h1>
      <p class="page-subtitle">Choose all relevant work components for this estimation</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔘</div> Work Components</div>
        <span class="badge badge-blue" id="sel-count">${STATE.selectedComponents.length} selected</span>
      </div>
      <div class="components-grid" id="comp-grid"></div>
      <div id="comp-hint" style="margin-top:1rem;font-size:0.8rem;color:var(--text-muted);padding:0.5rem 0.25rem">
        Select at least one component to continue.
      </div>
    </div>
  `;

  const grid = wrap.querySelector('#comp-grid');
  const cntBadge = wrap.querySelector('#sel-count');

  COMPONENTS.forEach(comp => {
    const tile = el('div', `component-tile${STATE.selectedComponents.includes(comp.id)?' selected':''}`);
    tile.innerHTML = `
      <div class="component-tile-check">✓</div>
      <div class="component-tile-icon">${comp.icon}</div>
      <div class="component-tile-label">${comp.label}</div>
    `;
    tile.addEventListener('click', () => {
      const idx = STATE.selectedComponents.indexOf(comp.id);
      if (idx === -1) STATE.selectedComponents.push(comp.id);
      else STATE.selectedComponents.splice(idx, 1);
      tile.classList.toggle('selected', STATE.selectedComponents.includes(comp.id));
      const cnt = STATE.selectedComponents.length;
      cntBadge.textContent = cnt + ' selected';
      // Update hint message
      const hint = wrap.querySelector('#comp-hint');
      if (hint) {
        if (cnt === 0) hint.textContent = 'Select at least one component to continue.';
        else {
          const hasPipeline = STATE.selectedComponents.includes('pipeline');
          const others = STATE.selectedComponents.filter(x => x !== 'pipeline');
          let msg = hasPipeline ? '✅ Pipe flow enabled (Pipes → Fittings → Summary)' : '';
          if (others.length) msg += (msg ? ' · ' : '') + `🚧 ${others.length} other section(s) marked "Coming Soon"`;
          hint.textContent = msg;
        }
      }
      saveState();
    });
    grid.appendChild(tile);
  });

  return wrap;
}

// ── Step 3: Pipes Only ───────────────────────────────────────
function renderStepPipesOnly() {
  const wrap = el('div');
  if (!STATE.pipes) STATE.pipes = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🚰 Pipe Entries</h1>
      <p class="page-subtitle">Select pipe type and size — official IS-standard rates auto-filled (Phase II)</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚰</div> Pipes (Running Meter)</div>
        <span class="badge badge-blue" id="pipe-count">${STATE.pipes.length} entries</span>
      </div>
      <div id="pipe-rows"></div>
      <button class="add-row-btn" id="add-pipe-row">＋ Add Pipe Entry</button>
    </div>
  `;

  const renderPipeRows = () => {
    const container = wrap.querySelector('#pipe-rows');
    container.innerHTML = '';
    wrap.querySelector('#pipe-count').textContent = STATE.pipes.length + ' entries';
    STATE.pipes.forEach((pipe, i) => {
      const pipeList = pipe.type ? (PIPE_CATALOGUE[pipe.type]?.pipes || []) : [];
      const row = el('div', 'item-row');
      row.style.gridTemplateColumns = '140px 1fr 120px auto auto';
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Pipe Type</label>
          <select class="form-control pipe-type-sel" data-i="${i}">
            <option value="">Select</option>
            ${PIPE_TYPES.map(t=>`<option ${pipe.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Description / Size</label>
          <select class="form-control pipe-dim-sel" data-i="${i}">
            <option value="">— Select pipe —</option>
            ${pipeList.map(p=>`<option ${pipe.dim===p.desc?'selected':''} value="${p.desc}" data-rate="${p.rate}" data-code="${p.code}">${p.desc}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Length (m)</label>
          <input type="number" class="form-control pipe-len" data-i="${i}" placeholder="0" min="0" value="${pipe.length||''}"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt(pipe.cost)}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon pipe-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.pipe-type-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.pipes[i].type = sel.value; STATE.pipes[i].dim = ''; STATE.pipes[i].rate = 0; STATE.pipes[i].cost = 0; STATE.pipes[i].code = '';
        saveState(); renderPipeRows();
      });
    });
    container.querySelectorAll('.pipe-dim-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        const opt = sel.options[sel.selectedIndex];
        STATE.pipes[i].dim  = sel.value;
        STATE.pipes[i].rate = +opt.dataset.rate || 0;
        STATE.pipes[i].code = opt.dataset.code  || '';
        STATE.pipes[i].cost = STATE.pipes[i].rate * (STATE.pipes[i].length||0);
        saveState(); renderPipeRows();
      });
    });
    container.querySelectorAll('.pipe-len').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE.pipes[i].length = +inp.value;
        STATE.pipes[i].cost   = (STATE.pipes[i].rate||0) * +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE.pipes[i].cost);
        saveState();
      });
    });
    container.querySelectorAll('.pipe-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.pipes.splice(+btn.dataset.i, 1);
        saveState(); renderPipeRows();
      });
    });
  };

  wrap.querySelector('#add-pipe-row').addEventListener('click', () => {
    STATE.pipes.push({ type:'', dim:'', length:0, rate:0, cost:0, code:'' });
    saveState(); renderPipeRows();
  });

  renderPipeRows();
  return wrap;
}

// ── Step 4: Fittings Only ─────────────────────────────────────
function renderStepFittings() {
  const wrap = el('div');
  if (!STATE.fittings) STATE.fittings = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🔩 Fittings & Accessories</h1>
      <p class="page-subtitle">Select fitting type — official IS-standard rates auto-filled (Phase II)</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> Fittings / Accessories (Per Piece)</div>
        <span class="badge badge-green" id="fitting-count">${STATE.fittings.length} entries</span>
      </div>
      <div id="fitting-rows"></div>
      <button class="add-row-btn" id="add-fitting-row">＋ Add Fitting Entry</button>
    </div>
  `;

  const renderFittingRows = () => {
    const container = wrap.querySelector('#fitting-rows');
    container.innerHTML = '';
    wrap.querySelector('#fitting-count').textContent = STATE.fittings.length + ' entries';
    STATE.fittings.forEach((fit, i) => {
      const fittingList = fit.type ? (PIPE_CATALOGUE[fit.type]?.fittings || []) : [];
      const row = el('div', 'item-row');
      row.style.gridTemplateColumns = '140px 1fr 120px auto auto';
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Pipe Type</label>
          <select class="form-control fit-type-sel" data-i="${i}">
            <option value="">Select</option>
            ${PIPE_TYPES.map(t=>`<option ${fit.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Fitting / Accessory</label>
          <select class="form-control fit-desc-sel" data-i="${i}">
            <option value="">— Select fitting —</option>
            ${fittingList.map(f=>`<option ${fit.desc===f.desc?'selected':''} value="${f.desc}" data-rate="${f.rate}" data-code="${f.code}" data-unit="${f.unit}">${f.desc}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Qty / Nos.</label>
          <input type="number" class="form-control fit-qty" data-i="${i}" placeholder="0" min="0" value="${fit.qty||''}"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt(fit.cost)}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon fit-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.fit-type-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.fittings[i].type = sel.value; STATE.fittings[i].desc = ''; STATE.fittings[i].rate = 0; STATE.fittings[i].cost = 0; STATE.fittings[i].code = '';
        saveState(); renderFittingRows();
      });
    });
    container.querySelectorAll('.fit-desc-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        const opt = sel.options[sel.selectedIndex];
        STATE.fittings[i].desc = sel.value;
        STATE.fittings[i].rate = +opt.dataset.rate || 0;
        STATE.fittings[i].code = opt.dataset.code  || '';
        STATE.fittings[i].unit = opt.dataset.unit  || 'PP';
        STATE.fittings[i].cost = STATE.fittings[i].rate * (STATE.fittings[i].qty||0);
        saveState(); renderFittingRows();
      });
    });
    container.querySelectorAll('.fit-qty').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE.fittings[i].qty  = +inp.value;
        STATE.fittings[i].cost = (STATE.fittings[i].rate||0) * +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE.fittings[i].cost);
        saveState();
      });
    });
    container.querySelectorAll('.fit-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.fittings.splice(+btn.dataset.i, 1);
        saveState(); renderFittingRows();
      });
    });
  };

  wrap.querySelector('#add-fitting-row').addEventListener('click', () => {
    STATE.fittings.push({ type:'', desc:'', qty:0, rate:0, cost:0, code:'', unit:'PP' });
    saveState(); renderFittingRows();
  });

  renderFittingRows();
  return wrap;
}

// ── Step 5: Pipe & Fittings Summary ──────────────────────────
function renderStepPipeSummary() {
  const wrap = el('div');
  const pipesTotal    = (STATE.pipes||[]).reduce((a,p)=>a+(p.cost||0),0);
  const fittingsTotal = (STATE.fittings||[]).reduce((a,f)=>a+(f.cost||0),0);
  const subTotal      = pipesTotal + fittingsTotal;

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📊 Pipes & Fittings Summary</h1>
      <p class="page-subtitle">Review all pipe and fitting entries before proceeding to Labour</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚰</div> (A) Pipes — Running Meter</div>
        <span class="badge badge-amber">${fmt(pipesTotal)}</span>
      </div>
      ${(STATE.pipes||[]).length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>#</th><th>Item Code</th><th>Type</th><th>Description</th><th>Length (m)</th><th>Rate/m</th><th>Amount</th></tr></thead>
          <tbody>
            ${(STATE.pipes||[]).map((p,i)=>`<tr>
              <td>${i+1}</td>
              <td style="font-size:0.7rem;color:var(--text-muted)">${p.code||'—'}</td>
              <td><span class="badge badge-blue">${p.type||'—'}</span></td>
              <td style="font-size:0.8rem">${p.dim||'—'}</td>
              <td class="table-number">${p.length||0}</td>
              <td class="table-number">${fmt(p.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(p.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">TOTAL (A)</td><td style="color:var(--accent);font-weight:700">${fmt(pipesTotal)}</td></tr></tfoot>
        </table>
      </div>` : '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No pipe entries added.</p>'}
    </div>

    <div class="card" style="margin-top:1rem">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> (B) Fittings & Accessories — Per Piece</div>
        <span class="badge badge-amber">${fmt(fittingsTotal)}</span>
      </div>
      ${(STATE.fittings||[]).length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>#</th><th>Item Code</th><th>Type</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            ${(STATE.fittings||[]).map((f,i)=>`<tr>
              <td>${i+1}</td>
              <td style="font-size:0.7rem;color:var(--text-muted)">${f.code||'—'}</td>
              <td><span class="badge badge-green">${f.type||'—'}</span></td>
              <td style="font-size:0.8rem">${f.desc||'—'}</td>
              <td class="table-number">${f.qty||0}</td>
              <td class="table-number">${fmt(f.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(f.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">TOTAL (B)</td><td style="color:var(--accent);font-weight:700">${fmt(fittingsTotal)}</td></tr></tfoot>
        </table>
      </div>` : '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No fitting entries added.</p>'}
    </div>

    <div class="cost-total-box" style="margin-top:1rem">
      <div class="cost-total-label">Sub-Total (Pipes + Fittings)</div>
      <div class="cost-total-amount">${fmt(subTotal)}</div>
      <div style="display:flex;justify-content:center;gap:2rem;margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted)">
        <span>Pipes (A): <strong style="color:var(--text-primary)">${fmt(pipesTotal)}</strong></span>
        <span>Fittings (B): <strong style="color:var(--text-primary)">${fmt(fittingsTotal)}</strong></span>
      </div>
    </div>
  `;

  return wrap;
}

// ── Step 6: Labour ───────────────────────────────────────────
function renderStepLabour() {
  return renderItemSection({
    title:    '👷 Labour Charges',
    subtitle: 'Add manpower details — rates per person per day',
    icon:     '👷',
    key:      'labour',
    presets:  LABOUR_ITEMS,
    badgeClass: 'badge-blue',
  });
}

// ── Step 7: Carriage ──────────────────────────────────────────
function renderStepCarriage() {
  return renderItemSection({
    title:    '🚛 Carriage Charges',
    subtitle: 'Add transportation / carriage costs',
    icon:     '🚛',
    key:      'carriage',
    presets:  CARRIAGE_ITEMS,
    badgeClass: 'badge-blue',
  });
}

// ── Step 8: Hardware Items ────────────────────────────────────
function renderStepHardware() {
  return renderItemSection({
    title:    '🔧 Hardware & Accessories',
    subtitle: 'Add tools, materials and miscellaneous items',
    icon:     '🔧',
    key:      'hardware',
    presets:  HARDWARE_ITEMS,
    badgeClass: 'badge-blue',
  });
}

// ── Shared item section renderer ──────────────────────────────
function renderItemSection({ title, subtitle, icon, key, presets, badgeClass }) {
  const wrap = el('div');
  if (!STATE[key]) STATE[key] = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${title}</h1>
      <p class="page-subtitle">${subtitle}</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">${icon}</div> Items</div>
        <span class="badge ${badgeClass}" id="item-count">${STATE[key].length} entries</span>
      </div>
      <div id="item-rows"></div>
      <button class="add-row-btn" id="add-item-row">＋ Add Entry</button>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">💰</div> Sub-Total</div>
      </div>
      <div class="table-wrapper" id="item-summary"></div>
    </div>
  `;

  const renderSummary = () => {
    const el2 = wrap.querySelector('#item-summary');
    if (!STATE[key].length) { el2.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No entries yet.</p>'; return; }
    const total = STATE[key].reduce((a,it) => a + (it.rate||0)*(it.qty||0), 0);
    el2.innerHTML = `<table>
      <thead><tr><th>#</th><th>Description</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>${STATE[key].map((it,i) => `<tr>
        <td>${i+1}</td>
        <td>${it.desc==='__custom__'?(it.customName||'Custom'):(it.desc||'—')}</td>
        <td class="table-number">${fmt(it.rate)}</td>
        <td class="table-number">${it.qty||0}</td>
        <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Sub-Total</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>`;
  };

  const renderRows = () => {
    const container = wrap.querySelector('#item-rows');
    container.innerHTML = '';
    wrap.querySelector('#item-count').textContent = STATE[key].length + ' entries';

    STATE[key].forEach((item, i) => {
      const row = el('div', 'item-row');
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Description</label>
          <select class="form-control item-name" data-i="${i}">
            <option value="">— Select —</option>
            ${presets.map(p=>`<option ${item.desc===p.desc?'selected':''} value="${p.desc}" data-rate="${p.rate}" data-unit="${p.unit}">${p.desc.substring(0,90)}</option>`).join('')}
            <option value="__custom__" ${item.desc==='__custom__'?'selected':''}>Custom…</option>
          </select>
        </div>
        ${item.desc==='__custom__' ? `
        <div class="form-group" style="margin:0">
          <label class="form-label">Custom Name</label>
          <input type="text" class="form-control item-custom-name" data-i="${i}" value="${item.customName||''}" placeholder="Item name"/>
        </div>` : ''}
        <div class="form-group" style="margin:0">
          <label class="form-label">Rate (₹)</label>
          <input type="number" class="form-control item-rate" data-i="${i}" min="0" value="${item.rate||''}" placeholder="0"/>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Qty / Nos.</label>
          <input type="number" class="form-control item-qty" data-i="${i}" min="0" value="${item.qty||''}" placeholder="0"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt((item.rate||0)*(item.qty||0))}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon item-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.item-name').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        const opt = sel.options[sel.selectedIndex];
        STATE[key][i].desc = sel.value;
        if (sel.value !== '__custom__') {
          STATE[key][i].rate = +opt.dataset.rate || 0;
          STATE[key][i].unit = opt.dataset.unit || '';
        }
        saveState(); renderRows(); renderSummary();
      });
    });
    container.querySelectorAll('.item-custom-name').forEach(inp => {
      inp.addEventListener('input', () => {
        STATE[key][+inp.dataset.i].customName = inp.value; saveState();
      });
    });
    container.querySelectorAll('.item-rate').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE[key][i].rate = +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt((STATE[key][i].rate||0)*(STATE[key][i].qty||0));
        saveState(); renderSummary();
      });
    });
    container.querySelectorAll('.item-qty').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE[key][i].qty = +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt((STATE[key][i].rate||0)*(STATE[key][i].qty||0));
        saveState(); renderSummary();
      });
    });
    container.querySelectorAll('.item-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE[key].splice(+btn.dataset.i, 1);
        saveState(); renderRows(); renderSummary();
      });
    });
  };

  wrap.querySelector('#add-item-row').addEventListener('click', () => {
    STATE[key].push({ desc:'', rate:0, qty:0, cost:0, unit:'' });
    saveState(); renderRows(); renderSummary();
  });

  renderRows();
  renderSummary();
  return wrap;
}

// ── Step 7: Preview / Indent ──────────────────────────────────
function renderStepPreview() {
  const sd = STATE.schemeDetails;

  const pipesTotal       = (STATE.pipes||[]).reduce((a,p)=>a+(p.cost||0),0);
  const fittingsTotal    = (STATE.fittings||[]).reduce((a,f)=>a+(f.cost||0),0);
  const valvesTotal      = (STATE.valves_items||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const subTotal         = (STATE.submersible_items||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const centTotal        = (STATE.centrifugal_items||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const elecTotal        = (STATE.electrical_items||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const esrTotal         = (STATE.esr_items||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const labourTotal      = (STATE.labour||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const carriageTotal    = (STATE.carriage||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const hardwareTotal    = (STATE.hardware||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const compTotal        = valvesTotal + subTotal + centTotal + elecTotal + esrTotal;
  const grandTotal       = pipesTotal + fittingsTotal + compTotal + labourTotal + carriageTotal + hardwareTotal;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🧾 Cost Estimate Preview</h1>
      <p class="page-subtitle">Review the complete estimation before final submission</p>
    </div>

    <div class="print-toolbar">
      <button class="btn btn-ghost btn-sm" id="edit-btn">✏️ Edit Any Section</button>
      <button class="btn btn-success btn-sm" id="save-btn">💾 Save Draft</button>
      <button class="btn btn-primary btn-sm" id="print-btn">🖨️ Print</button>
    </div>

    <!-- Header Info -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📄</div> Minor Repair & Replacement — Cost Estimate</div>
        <span class="badge badge-blue">${STATE.user?.role}</span>
      </div>
      <div class="summary-grid">
        ${[
          ['Scheme Name',   sd.scheme_name || '—'],
          ['IMIS ID',       sd.imis_id     || '—'],
          ['Zone',          sd.zone        || '—'],
          ['Circle',        sd.circle      || '—'],
          ['District',      sd.district    || '—'],
          ['Division',      sd.division    || '—'],
          ['Subdivision',   sd.subdivision || '—'],
          ['Block',         sd.block       || '—'],
          ['Gram Panchayat',sd.panchayat   || '—'],
          ['No. of FHTC',   sd.fhtc        || '—'],
          ['Incident Date', STATE.incidentDate || '—'],
          ['Priority',      STATE.incidentPriority || '—'],
        ].map(([k,v])=>`<div class="summary-item"><div class="summary-item-key">${k}</div><div class="summary-item-val">${v}</div></div>`).join('')}
      </div>
    </div>

    <!-- Components -->
    ${STATE.selectedComponents.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🧩</div> Selected Components</div>
        <span class="badge badge-green">${STATE.selectedComponents.length} components</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
        ${STATE.selectedComponents.map(id => {
          const c = COMPONENTS.find(x=>x.id===id);
          return c ? `<span class="badge badge-blue">${c.icon} ${c.label}</span>` : '';
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Pipes Table -->
    ${STATE.pipes?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚰</div> (A) Pipe Works</div>
        <span class="badge badge-amber">${fmt(pipesTotal)}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Sl.</th><th>Pipe Type</th><th>Dimension</th><th>Length (m)</th><th>Base Rate/m</th><th>Amount</th></tr></thead>
          <tbody>
            ${STATE.pipes.map((p,i)=>`<tr>
              <td>${i+1}</td>
              <td><span class="badge badge-blue">${p.type||'—'}</span></td>
              <td>${p.dim||'—'}</td>
              <td class="table-number">${p.length||0}</td>
              <td class="table-number">${fmt(p.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(p.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">TOTAL (A)</td><td style="color:var(--accent);font-weight:700">${fmt(pipesTotal)}</td></tr></tfoot>
        </table>
      </div>
    </div>` : ''}

    <!-- Fittings Table -->
    ${STATE.fittings?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> (A2) Pipe Fittings & Accessories</div>
        <span class="badge badge-amber">${fmt(fittingsTotal)}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Sl.</th><th>Item Code</th><th>Type</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            ${STATE.fittings.map((f,i)=>`<tr>
              <td>${i+1}</td>
              <td style="font-size:0.7rem;color:var(--text-muted)">${f.code||'—'}</td>
              <td><span class="badge badge-green">${f.type||'—'}</span></td>
              <td style="font-size:0.8rem">${f.desc||'—'}</td>
              <td class="table-number">${f.qty||0}</td>
              <td class="table-number">${fmt(f.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(f.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">TOTAL (A2)</td><td style="color:var(--accent);font-weight:700">${fmt(fittingsTotal)}</td></tr></tfoot>
        </table>
      </div>
    </div>` : ''}

    <!-- Component Tables -->
    ${valvesTotal ? `<div class="card"><div class="card-header"><div class="card-title"><div class="card-icon">⚙️</div> Valves & Accessories</div><span class="badge badge-amber">${fmt(valvesTotal)}</span></div>${renderItemsTable(STATE.valves_items||[],'TOTAL (Valves)',valvesTotal)}</div>` : ''}
    ${subTotal ? `<div class="card"><div class="card-header"><div class="card-title"><div class="card-icon">💧</div> Submersible Pump Works</div><span class="badge badge-amber">${fmt(subTotal)}</span></div>${renderItemsTableWithUnit(STATE.submersible_items||[],'TOTAL (Submersible)',subTotal)}</div>` : ''}
    ${centTotal ? `<div class="card"><div class="card-header"><div class="card-title"><div class="card-icon">🔩</div> Centrifugal Pump Works</div><span class="badge badge-amber">${fmt(centTotal)}</span></div>${renderItemsTableWithUnit(STATE.centrifugal_items||[],'TOTAL (Centrifugal)',centTotal)}</div>` : ''}
    ${elecTotal ? `<div class="card"><div class="card-header"><div class="card-title"><div class="card-icon">⚡</div> Electrical Items</div><span class="badge badge-amber">${fmt(elecTotal)}</span></div>${renderItemsTableWithUnit(STATE.electrical_items||[],'TOTAL (Electrical)',elecTotal)}</div>` : ''}
    ${esrTotal ? `<div class="card"><div class="card-header"><div class="card-title"><div class="card-icon">🏗️</div> ESR Painting</div><span class="badge badge-amber">${fmt(esrTotal)}</span></div>${renderItemsTableWithUnit(STATE.esr_items||[],'TOTAL (ESR)',esrTotal)}</div>` : ''}

    <!-- Labour Table -->
    ${STATE.labour?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">👷</div> (B) Labour Charges</div>
        <span class="badge badge-amber">${fmt(labourTotal)}</span>
      </div>
      ${renderItemsTable(STATE.labour, 'TOTAL (B)', labourTotal)}
    </div>` : ''}

    <!-- Carriage Table -->
    ${STATE.carriage?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚛</div> (C) Carriage Charges</div>
        <span class="badge badge-amber">${fmt(carriageTotal)}</span>
      </div>
      ${renderItemsTable(STATE.carriage, 'TOTAL (C)', carriageTotal)}
    </div>` : ''}

    <!-- Hardware Table -->
    ${STATE.hardware?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> (D) Hardware & Accessories</div>
        <span class="badge badge-amber">${fmt(hardwareTotal)}</span>
      </div>
      ${renderItemsTable(STATE.hardware, 'TOTAL (D)', hardwareTotal)}
    </div>` : ''}

    <!-- Grand Total -->
    <div class="cost-total-box">
      <div class="cost-total-label">Total Cost Estimate for Repair / Replacement</div>
      <div class="cost-total-amount">${fmt(grandTotal)}</div>
      <div class="cost-total-words">(${numberToWords(Math.round(grandTotal))})</div>
      <div style="display:flex;justify-content:center;gap:1.5rem;margin-top:1rem;flex-wrap:wrap;font-size:0.78rem;color:var(--text-muted)">
        ${pipesTotal    ? `<span>Pipes: <strong style="color:var(--text-primary)">${fmt(pipesTotal)}</strong></span>` : ''}
        ${fittingsTotal ? `<span>Fittings: <strong style="color:var(--text-primary)">${fmt(fittingsTotal)}</strong></span>` : ''}
        ${valvesTotal   ? `<span>Valves: <strong style="color:var(--text-primary)">${fmt(valvesTotal)}</strong></span>` : ''}
        ${subTotal      ? `<span>Submersible: <strong style="color:var(--text-primary)">${fmt(subTotal)}</strong></span>` : ''}
        ${centTotal     ? `<span>Centrifugal: <strong style="color:var(--text-primary)">${fmt(centTotal)}</strong></span>` : ''}
        ${elecTotal     ? `<span>Electrical: <strong style="color:var(--text-primary)">${fmt(elecTotal)}</strong></span>` : ''}
        ${esrTotal      ? `<span>ESR: <strong style="color:var(--text-primary)">${fmt(esrTotal)}</strong></span>` : ''}
        ${labourTotal   ? `<span>Labour: <strong style="color:var(--text-primary)">${fmt(labourTotal)}</strong></span>` : ''}
        ${carriageTotal ? `<span>Carriage: <strong style="color:var(--text-primary)">${fmt(carriageTotal)}</strong></span>` : ''}
        ${hardwareTotal ? `<span>Hardware: <strong style="color:var(--text-primary)">${fmt(hardwareTotal)}</strong></span>` : ''}
      </div>
    </div>

    <!-- Signature Block -->
    <div class="card" style="margin-top:1.25rem">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;text-align:center;font-size:0.8rem;color:var(--text-muted)">
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Prepared By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">${STATE.user?.username} (${STATE.user?.role})</div>
        </div>
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Checked By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">SDO</div>
        </div>
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Approved By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">EE</div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#edit-btn')?.addEventListener('click', () => {
    STATE.currentStep = 0; saveState(); render(); window.scrollTo(0,0);
  });
  wrap.querySelector('#save-btn')?.addEventListener('click', () => {
    saveState(); showToast('Draft saved successfully!');
  });
  wrap.querySelector('#print-btn')?.addEventListener('click', () => {
    window.print();
  });

  return wrap;
}

function renderItemsTableWithUnit(items, footerLabel, total) {
  return `<div class="table-wrapper">
    <table>
      <thead><tr><th>Sl.</th><th>Description</th><th>Unit</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>
        ${items.map((it,i)=>`<tr>
          <td>${i+1}</td>
          <td style="font-size:0.8rem">${it.desc==='__custom__'?(it.customName||'Custom'):(it.desc||'—')}</td>
          <td style="font-size:0.75rem;color:var(--text-muted)">${it.unit||''}</td>
          <td class="table-number">${fmt(it.rate)}</td>
          <td class="table-number">${it.qty||0}</td>
          <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">${footerLabel}</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>
  </div>`;
}

function renderItemsTable(items, footerLabel, total) {
  return `<div class="table-wrapper">
    <table>
      <thead><tr><th>Sl.</th><th>Description</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>
        ${items.map((it,i)=>`<tr>
          <td>${i+1}</td>
          <td>${it.desc==='__custom__'?(it.customName||'Custom'):(it.desc||'—')}</td>
          <td class="table-number">${fmt(it.rate)}</td>
          <td class="table-number">${it.qty||0}</td>
          <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">${footerLabel}</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>
  </div>`;
}

// ── Bootstrap ─────────────────────────────────────────────────
// If session exists, restore step. If not, go to login.
if (STATE.user && STATE.currentStep >= 0) {
  // session restored
} else {
  STATE.currentStep = -1;
  STATE.user = null;
}

render();
