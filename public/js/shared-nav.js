// Shared Navigation & Persona Switcher for SwiftPick Express

function renderSharedNav(activePage) {
  const container = document.getElementById('shared-nav-container');
  if (!container) return;

  const roles = [
    { id: 'customer', label: '🛒 Customer App', path: '/index.html' },
    { id: 'picker', label: '📋 Store Picker KDS', path: '/picker.html' },
    { id: 'counter', label: '⚡ Express Counter', path: '/counter.html' },
    { id: 'manager', label: '📊 Store Manager', path: '/manager.html' }
  ];

  container.innerHTML = `
    <header class="demo-role-nav">
      <a href="/index.html" class="demo-role-logo">
        <span class="logo-badge">EXPRESS</span>
        <span>SwiftPick</span>
      </a>

      <nav class="role-switcher-links">
        ${roles.map(r => `
          <a href="${r.path}" class="role-tab-btn ${activePage === r.id ? 'active' : ''}">
            ${r.label}
          </a>
        `).join('')}
      </nav>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div class="status-pill" id="ws-status-pill">
          <span class="pulse-dot"></span>
          <span id="ws-status-text">Socket: Online</span>
        </div>
      </div>
    </header>
  `;
}

// Built-in Web Audio Chime generator (No external audio file dependencies!)
function playChime(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // AudioContext blocked or not allowed until interaction
  }
}

window.renderSharedNav = renderSharedNav;
window.playChime = playChime;
