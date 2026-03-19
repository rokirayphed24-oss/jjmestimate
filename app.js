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
const STEPS = [
  { name: 'Scheme',      icon: '🏛️' },
  { name: 'Incident',    icon: '📅' },
  { name: 'Components',  icon: '🧩' },
  { name: 'Pipes',       icon: '🔧' },
  { name: 'Labour',      icon: '👷' },
  { name: 'Preview',     icon: '🧾' },
];

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

const PIPE_TYPES = ['HDPE', 'UPVC', 'GI', 'CI', 'PPR'];

const PIPE_DIMS = {
  HDPE: ['20 mm PN6','25 mm PN6','32 mm PN6','40 mm PN6','50 mm PN6','63 mm PN6','75 mm PN6','90 mm PN6','110 mm PN6','125 mm PN6','140 mm PN6','160 mm PN6'],
  UPVC: ['20 mm','25 mm','32 mm','40 mm','50 mm','63 mm','75 mm','90 mm','110 mm','125 mm'],
  GI:   ['15 mm (1/2")','20 mm (3/4")','25 mm (1")','32 mm (1.25")','40 mm (1.5")','50 mm (2")','65 mm (2.5")','80 mm (3")','100 mm (4")'],
  CI:   ['80 mm','100 mm','125 mm','150 mm','200 mm','250 mm','300 mm'],
  PPR:  ['20 mm','25 mm','32 mm','40 mm','50 mm','63 mm','75 mm','90 mm'],
};

// Base rates per meter (approximate)
const PIPE_RATES = {
  HDPE: { '20 mm PN6':28,'25 mm PN6':38,'32 mm PN6':52,'40 mm PN6':72,'50 mm PN6':108,'63 mm PN6':155,'75 mm PN6':210,'90 mm PN6':295,'110 mm PN6':430,'125 mm PN6':540,'140 mm PN6':680,'160 mm PN6':880 },
  UPVC: { '20 mm':22,'25 mm':30,'32 mm':42,'40 mm':58,'50 mm':85,'63 mm':120,'75 mm':165,'90 mm':235,'110 mm':340,'125 mm':430 },
  GI:   { '15 mm (1/2")':95,'20 mm (3/4")':130,'25 mm (1")':175,'32 mm (1.25")':230,'40 mm (1.5")':290,'50 mm (2")':390,'65 mm (2.5")':510,'80 mm (3")':650,'100 mm (4")':880 },
  CI:   { '80 mm':480,'100 mm':620,'125 mm':810,'150 mm':1050,'200 mm':1480,'250 mm':2100,'300 mm':2850 },
  PPR:  { '20 mm':35,'25 mm':48,'32 mm':65,'40 mm':88,'50 mm':130,'63 mm':185,'75 mm':255,'90 mm':360 },
};

const LABOUR_ITEMS = [
  { name: 'Plumber Grade I',       unit: 'per person per day', rate: 973  },
  { name: 'Plumber Grade II',      unit: 'per person per day', rate: 792  },
  { name: 'Ordinary Labourer',     unit: 'per person per day', rate: 600  },
  { name: 'Mason Grade I',         unit: 'per person per day', rate: 890  },
  { name: 'Skilled Electrician',   unit: 'per person per day', rate: 1050 },
  { name: 'Helper',                unit: 'per person per day', rate: 520  },
];

const CARRIAGE_ITEMS = [
  { name: 'Carriage 0–10 km, 0–11 kg',   unit: 'per trip', rate: 700  },
  { name: 'Carriage 11–20 km, 11–50 kg', unit: 'per trip', rate: 1800 },
  { name: 'Carriage 21–30 km, 51–100 kg',unit: 'per trip', rate: 2800 },
  { name: 'Carriage 31–50 km, >100 kg',  unit: 'per trip', rate: 4200 },
];

const HARDWARE_ITEMS = [
  { name: 'Teflon Tape (1 inch wide)',                unit: 'per pc',          rate: 46   },
  { name: 'Electro Fusion Pipe Machine (HDPE)',        unit: 'per day',         rate: 1000 },
  { name: 'PVC Rubber Lubricants 250g',                unit: 'per pc',          rate: 153  },
  { name: 'Heavy Duty Pipe Wrench 300mm',              unit: 'per pc',          rate: 642  },
  { name: 'Pipe Cutter Set',                           unit: 'per pc',          rate: 480  },
  { name: 'G.I. Socket 15mm',                          unit: 'per pc',          rate: 35   },
  { name: 'G.I. Elbow 15mm',                           unit: 'per pc',          rate: 42   },
  { name: 'G.I. Tee 25mm',                             unit: 'per pc',          rate: 65   },
  { name: 'HDPE Electrofusion Coupler 90mm',           unit: 'per pc',          rate: 285  },
  { name: 'HDPE Electrofusion Elbow 90mm',             unit: 'per pc',          rate: 320  },
  { name: 'Gate Valve 50mm',                           unit: 'per pc',          rate: 1850 },
  { name: 'Sluice Valve 80mm',                         unit: 'per pc',          rate: 3200 },
  { name: 'Pressure Gauge',                            unit: 'per pc',          rate: 780  },
  { name: 'M-Seal Quick Fix',                          unit: 'per pack',        rate: 120  },
  { name: 'Fevicol SH 1 kg',                          unit: 'per kg',          rate: 195  },
];

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

      <div class="login-divider">Secure Login</div>

      <button class="btn btn-primary btn-lg btn-full" id="login-btn">
        <span>Sign In</span> <span>→</span>
      </button>

      <p style="margin-top:1.25rem;font-size:0.75rem;color:var(--text-muted);text-align:center;">
        Demo: any username/password | All roles accepted
      </p>
    </div>
  `;

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
  return h;
}

function renderStepper() {
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
      STATE.currentStep++; saveState(); render(); window.scrollTo(0,0);
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
function renderStep(step) {
  const renderers = [
    renderStepScheme,
    renderStepIncident,
    renderStepComponents,
    renderStepPipes,
    renderStepLabour,
    renderStepPreview,
  ];
  return renderers[step]?.() || el('div','','Unknown step');
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
            ${['North Zone','South Zone','East Zone','West Zone','Central Zone'].map(z=>`<option ${sd.zone===z?'selected':''} value="${z}">${z}</option>`).join('')}
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
      cntBadge.textContent = STATE.selectedComponents.length + ' selected';
      saveState();
    });
    grid.appendChild(tile);
  });

  return wrap;
}

// ── Step 3: Pipes ─────────────────────────────────────────────
function renderStepPipes() {
  const wrap = el('div');
  if (!STATE.pipes) STATE.pipes = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🔧 Pipe Repair Details</h1>
      <p class="page-subtitle">Add pipe types, dimensions, quantities and auto-calculated costs</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚰</div> Pipe Entries</div>
      </div>
      <div id="pipe-rows"></div>
      <button class="add-row-btn" id="add-pipe-row">＋ Add Pipe Entry</button>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">💰</div> Pipe Cost Summary</div>
      </div>
      <div class="table-wrapper" id="pipe-summary-table"></div>
    </div>
  `;

  const renderPipeSummary = () => {
    const tbody = wrap.querySelectorAll('#pipe-summary-table')[0];
    if (!STATE.pipes.length) { tbody.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No pipe entries yet.</p>'; return; }
    const total = STATE.pipes.reduce((a,p) => a + (p.cost||0), 0);
    tbody.innerHTML = `<table>
      <thead><tr><th>#</th><th>Pipe Type</th><th>Dimension</th><th>Length (m)</th><th>Rate/m</th><th>Amount</th></tr></thead>
      <tbody>
        ${STATE.pipes.map((p,i) => `<tr>
          <td>${i+1}</td>
          <td><span class="badge badge-blue">${p.type||'—'}</span></td>
          <td>${p.dim||'—'}</td>
          <td class="table-number">${p.length||0}</td>
          <td class="table-number">${fmt(p.rate)}</td>
          <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(p.cost)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="5" style="text-align:right">Sub-Total (Pipes)</td><td style="color:var(--accent)">${fmt(total)}</td></tr></tfoot>
    </table>`;
  };

  const renderRows = () => {
    const container = wrap.querySelector('#pipe-rows');
    container.innerHTML = '';
    STATE.pipes.forEach((pipe, i) => {
      const row = el('div', 'item-row');
      const dims = pipe.type ? (PIPE_DIMS[pipe.type]||[]) : [];
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Pipe Type</label>
          <select class="form-control pipe-type-sel" data-i="${i}">
            <option value="">Select</option>
            ${PIPE_TYPES.map(t=>`<option ${pipe.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Dimension</label>
          <select class="form-control pipe-dim-sel" data-i="${i}">
            <option value="">Select</option>
            ${dims.map(d=>`<option ${pipe.dim===d?'selected':''} value="${d}">${d}</option>`).join('')}
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
          <button class="btn btn-danger btn-sm btn-icon pipe-del" data-i="${i}" title="Remove">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    // Events
    container.querySelectorAll('.pipe-type-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.pipes[i].type = sel.value;
        STATE.pipes[i].dim = '';
        STATE.pipes[i].rate = 0;
        STATE.pipes[i].cost = 0;
        saveState(); renderRows(); renderPipeSummary();
      });
    });
    container.querySelectorAll('.pipe-dim-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.pipes[i].dim = sel.value;
        const rate = PIPE_RATES[STATE.pipes[i].type]?.[sel.value] || 0;
        STATE.pipes[i].rate = rate;
        STATE.pipes[i].cost = rate * (STATE.pipes[i].length || 0);
        saveState(); renderRows(); renderPipeSummary();
      });
    });
    container.querySelectorAll('.pipe-len').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE.pipes[i].length = +inp.value;
        STATE.pipes[i].cost = (STATE.pipes[i].rate||0) * +inp.value;
        saveState(); renderPipeSummary();
        // Update amount display inline
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE.pipes[i].cost);
      });
    });
    container.querySelectorAll('.pipe-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.pipes.splice(+btn.dataset.i, 1);
        saveState(); renderRows(); renderPipeSummary();
      });
    });
  };

  wrap.querySelector('#add-pipe-row').addEventListener('click', () => {
    STATE.pipes.push({ type:'', dim:'', length:0, rate:0, cost:0 });
    saveState(); renderRows(); renderPipeSummary();
  });

  renderRows();
  renderPipeSummary();
  return wrap;
}

// ── Step 4: Labour ────────────────────────────────────────────
function renderStepLabour() {
  const wrap = el('div');
  if (!STATE.labour)   STATE.labour   = [];
  if (!STATE.carriage) STATE.carriage = [];
  if (!STATE.hardware) STATE.hardware = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">👷 Labour, Carriage & Hardware</h1>
      <p class="page-subtitle">Add manpower, transport and material costs</p>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="labour">👷 Labour</button>
      <button class="tab-btn" data-tab="carriage">🚛 Carriage</button>
      <button class="tab-btn" data-tab="hardware">🔩 Hardware Items</button>
    </div>

    <div id="tab-labour"  class="tab-panel active"></div>
    <div id="tab-carriage" class="tab-panel"></div>
    <div id="tab-hardware" class="tab-panel"></div>
  `;

  // Tab switching
  wrap.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelector(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  const renderSectionRows = (key, items, container) => {
    container.innerHTML = '';
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Items</div>
      </div>
      <div id="${key}-rows"></div>
      <button class="add-row-btn" id="add-${key}-row">＋ Add Entry</button>
      <div class="table-wrapper" style="margin-top:1rem" id="${key}-summary"></div>
    `;
    container.appendChild(card);

    const renderRows = () => {
      const rowsEl = card.querySelector(`#${key}-rows`);
      rowsEl.innerHTML = '';
      STATE[key].forEach((item, i) => {
        const presets = items;
        const row = el('div', 'item-row');
        row.innerHTML = `
          <div class="form-group" style="margin:0">
            <label class="form-label">Description</label>
            <select class="form-control item-name" data-i="${i}">
              <option value="">— Select —</option>
              ${presets.map(p=>`<option ${item.name===p.name?'selected':''} value="${p.name}" data-rate="${p.rate}" data-unit="${p.unit}">${p.name}</option>`).join('')}
              <option value="__custom__" ${item.name==='__custom__'?'selected':''}>Custom…</option>
            </select>
          </div>
          ${item.name==='__custom__' ? `<div class="form-group" style="margin:0">
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
        rowsEl.appendChild(row);
      });

      rowsEl.querySelectorAll('.item-name').forEach(sel => {
        sel.addEventListener('change', () => {
          const i = +sel.dataset.i;
          const opt = sel.options[sel.selectedIndex];
          STATE[key][i].name = sel.value;
          if (sel.value !== '__custom__') {
            STATE[key][i].rate = +opt.dataset.rate || 0;
            STATE[key][i].unit = opt.dataset.unit || '';
          }
          saveState(); renderRows(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-custom-name').forEach(inp => {
        inp.addEventListener('input', () => {
          STATE[key][+inp.dataset.i].customName = inp.value; saveState();
        });
      });

      rowsEl.querySelectorAll('.item-rate').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = +inp.dataset.i;
          STATE[key][i].rate = +inp.value;
          STATE[key][i].cost = (STATE[key][i].rate||0) * (STATE[key][i].qty||0);
          inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE[key][i].cost);
          saveState(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-qty').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = +inp.dataset.i;
          STATE[key][i].qty = +inp.value;
          STATE[key][i].cost = (STATE[key][i].rate||0) * (STATE[key][i].qty||0);
          inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE[key][i].cost);
          saveState(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-del').forEach(btn => {
        btn.addEventListener('click', () => {
          STATE[key].splice(+btn.dataset.i, 1);
          saveState(); renderRows(); renderSummary();
        });
      });
    };

    const renderSummary = () => {
      const sumEl = card.querySelector(`#${key}-summary`);
      if (!STATE[key].length) { sumEl.innerHTML = ''; return; }
      const total = STATE[key].reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
      sumEl.innerHTML = `<table>
        <thead><tr><th>#</th><th>Description</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          ${STATE[key].map((it,i)=>`<tr>
            <td>${i+1}</td>
            <td>${it.name==='__custom__'?(it.customName||'Custom'):(it.name||'—')}</td>
            <td class="table-number">${fmt(it.rate)}</td>
            <td class="table-number">${it.qty||0}</td>
            <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" style="text-align:right">Sub-Total</td><td style="color:var(--accent)">${fmt(total)}</td></tr></tfoot>
      </table>`;
    };

    card.querySelector(`#add-${key}-row`).addEventListener('click', () => {
      STATE[key].push({ name:'', rate:0, qty:0, cost:0 });
      saveState(); renderRows(); renderSummary();
    });

    renderRows();
    renderSummary();
  };

  renderSectionRows('labour', LABOUR_ITEMS, wrap.querySelector('#tab-labour'));
  renderSectionRows('carriage', CARRIAGE_ITEMS, wrap.querySelector('#tab-carriage'));
  renderSectionRows('hardware', HARDWARE_ITEMS, wrap.querySelector('#tab-hardware'));

  return wrap;
}

// ── Step 5: Preview / Indent ──────────────────────────────────
function renderStepPreview() {
  const sd = STATE.schemeDetails;

  const pipesTotal    = (STATE.pipes||[]).reduce((a,p)=>a+(p.cost||0),0);
  const labourTotal   = (STATE.labour||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const carriageTotal = (STATE.carriage||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const hardwareTotal = (STATE.hardware||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const grandTotal    = pipesTotal + labourTotal + carriageTotal + hardwareTotal;

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
        <span>Pipes: <strong style="color:var(--text-primary)">${fmt(pipesTotal)}</strong></span>
        <span>Labour: <strong style="color:var(--text-primary)">${fmt(labourTotal)}</strong></span>
        <span>Carriage: <strong style="color:var(--text-primary)">${fmt(carriageTotal)}</strong></span>
        <span>Hardware: <strong style="color:var(--text-primary)">${fmt(hardwareTotal)}</strong></span>
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

function renderItemsTable(items, footerLabel, total) {
  return `<div class="table-wrapper">
    <table>
      <thead><tr><th>Sl.</th><th>Description</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>
        ${items.map((it,i)=>`<tr>
          <td>${i+1}</td>
          <td>${it.name==='__custom__'?(it.customName||'Custom'):(it.name||'—')}</td>
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
