import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Socket as TcpSocket, createConnection } from 'net';

// ─── Constants ───────────────────────────────────────────────────────────────

const PORT = 3002;
const COMMAND_TIMEOUT = 3000;
const CONNECTION_TIMEOUT = 5000;

const VALID_COMMANDS = new Set([
  'MU', 'MD', 'ML', 'MR', 'MUL', 'MUR', 'MDL', 'MDR', 'STP',
  'SPD', 'POS', 'GOTO', 'HOM', 'PNG', 'STA', 'RST',
  'SPRS', 'RPRS', 'SSWG', 'ESWG',
  'SET_ACC', 'SET_DEC', 'SET_DZ', 'SET_LIM', 'SET_APT',
  'SET_BC', 'SET_SMODE', 'SET_TW', 'SET_TS', 'SET_EREC',
  'SET_PRI', 'SET_VF', 'SET_DAMP', 'SET_MCUR', 'SET_SYNC',
  // TL.0400 specific
  'SET_ACC_T', 'SET_ACC_P', 'SET_DEC_T', 'SET_DEC_P',
  'SET_LIM_T', 'SET_LIM_P', 'SET_SMODE_T', 'SET_SMODE_P',
  // Self-diagnostics
  'DIAG', 'VER', 'SN', 'HWINFO', 'ERRLOG', 'CLRERR',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeviceConnection {
  model: string;
  tiltSocket: TcpSocket | null;
  panSocket: TcpSocket | null;
  tiltIp: string;
  tiltPort: number;
  panIp: string;
  panPort: number;
  connected: boolean;
  connectedAt: number | null;
  lastError: string | null;
  speed: number;
  azimuth: number;
  elevation: number;
  status: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

const devices = new Map<string, DeviceConnection>();
const startTime = Date.now();

function getDevice(model: string): DeviceConnection | undefined {
  return devices.get(model);
}

function getOrCreateDevice(model: string): DeviceConnection {
  let device = devices.get(model);
  if (!device) {
    const isDual = model === 'TL.0400';
    device = {
      model,
      tiltSocket: null,
      panSocket: null,
      tiltIp: isDual ? '192.168.1.115' : '192.168.1.115',
      tiltPort: 9760,
      panIp: isDual ? '192.168.1.116' : '192.168.1.115',
      panPort: 9760,
      connected: false,
      connectedAt: null,
      lastError: null,
      speed: 5,
      azimuth: 0,
      elevation: 0,
      status: 'disconnected',
    };
    devices.set(model, device);
  }
  return device;
}

// ─── TCP Manager ─────────────────────────────────────────────────────────────

function connectTcpSocket(ip: string, port: number): Promise<TcpSocket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: ip, port, timeout: CONNECTION_TIMEOUT });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP connection timeout to ${ip}:${port} (${CONNECTION_TIMEOUT}ms)`));
    }, CONNECTION_TIMEOUT);

    socket.on('connect', () => {
      clearTimeout(timer);
      // Clear the connection timeout so the socket stays open
      socket.setTimeout(0);
      console.log(`[TCP] Connected to ${ip}:${port}`);
      resolve(socket);
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      console.error(`[TCP] Error connecting to ${ip}:${port}: ${err.message}`);
      reject(new Error(`TCP connect error to ${ip}:${port}: ${err.message}`));
    });

    socket.on('timeout', () => {
      // Idle timeout on persistent socket — just log it
      console.warn(`[TCP] Idle timeout on ${ip}:${port}`);
    });

    socket.on('close', (hadError) => {
      console.log(`[TCP] Connection closed to ${ip}:${port} (error: ${hadError})`);
    });
  });
}

function sendTcpCommand(socket: TcpSocket, rawCommand: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullCommand = `${rawCommand}\r\n`;
    console.log(`[TCP] TX → ${rawCommand.replace(/\r?\n/g, '\\r\\n')}`);

    const timer = setTimeout(() => {
      // Remove listener to prevent leaks
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      reject(new Error(`Command timeout after ${COMMAND_TIMEOUT}ms: ${rawCommand}`));
    }, COMMAND_TIMEOUT);

    function onData(data: Buffer) {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);

      const response = data.toString().trim();
      console.log(`[TCP] RX ← ${response}`);
      resolve(response);
    }

    function onError(err: Error) {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('close', onClose);
      reject(new Error(`TCP error on command ${rawCommand}: ${err.message}`));
    }

    function onClose() {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      reject(new Error(`TCP connection closed during command: ${rawCommand}`));
    }

    socket.once('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);

    socket.write(fullCommand, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
        reject(new Error(`TCP write error: ${err.message}`));
      }
    });
  });
}

function destroyDeviceConnection(device: DeviceConnection) {
  if (device.tiltSocket) {
    try { device.tiltSocket.destroy(); } catch {}
    device.tiltSocket = null;
  }
  if (device.panSocket) {
    try { device.panSocket.destroy(); } catch {}
    device.panSocket = null;
  }
  device.connected = false;
  device.connectedAt = null;
  device.status = 'disconnected';
  device.lastError = null;
}

function isDeviceConnected(device: DeviceConnection): boolean {
  return device.connected &&
    device.tiltSocket !== null &&
    (device.model === 'TL.0400' ? device.panSocket !== null : true);
}

// ─── Command Router ──────────────────────────────────────────────────────────

const TL0400_TILT_COMMANDS = new Set([
  'MU', 'MD', 'SET_ACC_T', 'SET_DEC_T', 'SET_LIM_T', 'SET_SMODE_T',
  'SET_ACC', 'SET_DEC', 'SET_DZ', 'SET_LIM', 'SET_APT',
  'SET_BC', 'SET_SMODE', 'SET_TW', 'SET_TS', 'SET_EREC',
  'SET_PRI', 'SET_VF', 'SET_DAMP', 'SET_MCUR', 'SET_SYNC',
  'SPRS', 'RPRS', 'HOM', 'POS', 'STA', 'PNG', 'RST', 'STP', 'SSWG', 'ESWG',
]);

const TL0400_PAN_COMMANDS = new Set([
  'ML', 'MR', 'SET_ACC_P', 'SET_DEC_P', 'SET_LIM_P', 'SET_SMODE_P',
]);

function routeCommandToDevice(
  device: DeviceConnection,
  command: string,
  value?: string,
): Promise<string> {
  if (!isDeviceConnected(device)) {
    return Promise.reject(new Error(`Device ${device.model} is not connected`));
  }

  const rawCommand = value ? `${command} ${value}` : command;
  const isDual = device.model === 'TL.0400';

  if (isDual) {
    // TL.0400: route to tilt or pan socket based on command type
    const baseCommand = command.split('_').slice(0, 2).join('_');
    const isTilt = TL0400_TILT_COMMANDS.has(command) || TL0400_TILT_COMMANDS.has(baseCommand);

    // Diagonal commands (MUL, MUR, MDL, MDR) need both sockets
    const diagonalCommands = ['MUL', 'MUR', 'MDL', 'MDR'];
    if (diagonalCommands.includes(command)) {
      const tiltMap: Record<string, string> = { MUL: 'MU', MUR: 'MU', MDL: 'MD', MDR: 'MD' };
      const panMap: Record<string, string> = { MUL: 'ML', MUR: 'MR', MDL: 'ML', MDR: 'MR' };
      const tiltCmd = tiltMap[command];
      const panCmd = panMap[command];

      if (!device.tiltSocket || !device.panSocket) {
        return Promise.reject(new Error(`Device ${device.model} missing tilt or pan socket`));
      }

      // Send to both sockets concurrently
      return Promise.all([
        sendTcpCommand(device.tiltSocket, tiltCmd),
        sendTcpCommand(device.panSocket, panCmd),
      ]).then(([tiltRes, panRes]) => {
        return `${tiltRes} | ${panRes}`;
      });
    }

    // GOTO needs both
    if (command === 'GOTO' && value) {
      if (!device.tiltSocket || !device.panSocket) {
        return Promise.reject(new Error(`Device ${device.model} missing tilt or pan socket`));
      }
      const parts = value.split(',');
      const el = parts[1]?.trim() || '0';
      const az = parts[0]?.trim() || '0';
      return Promise.all([
        sendTcpCommand(device.tiltSocket, `GOTO 0,${el}`),
        sendTcpCommand(device.panSocket, `GOTO ${az},0`),
      ]).then(([tiltRes, panRes]) => {
        return `${tiltRes} | ${panRes}`;
      });
    }

    // SPD needs both
    if (command === 'SPD') {
      if (!device.tiltSocket || !device.panSocket) {
        return Promise.reject(new Error(`Device ${device.model} missing tilt or pan socket`));
      }
      return Promise.all([
        sendTcpCommand(device.tiltSocket, rawCommand),
        sendTcpCommand(device.panSocket, rawCommand),
      ]).then(([tiltRes, panRes]) => {
        return `${tiltRes} | ${panRes}`;
      });
    }

    if (isTilt && device.tiltSocket) {
      return sendTcpCommand(device.tiltSocket, rawCommand);
    } else if (device.panSocket) {
      return sendTcpCommand(device.panSocket, rawCommand);
    } else {
      return Promise.reject(new Error(`No suitable TCP socket for command ${command} on ${device.model}`));
    }
  } else {
    // Single-socket devices (TL.0009, TL.0250, TL.0320)
    if (!device.tiltSocket) {
      return Promise.reject(new Error(`Device ${device.model} not connected`));
    }
    return sendTcpCommand(device.tiltSocket, rawCommand);
  }
}

// ─── Direction Mapping ───────────────────────────────────────────────────────

const DIRECTION_MAP: Record<string, string> = {
  'up': 'MU',
  'down': 'MD',
  'left': 'ML',
  'right': 'MR',
  'up-left': 'MUL',
  'up-right': 'MUR',
  'down-left': 'MDL',
  'down-right': 'MDR',
};

// ─── Express + HTTP Server ───────────────────────────────────────────────────

const app = express();
app.use(express.json());

const httpServer = createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── HTTP REST Endpoints ─────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  const deviceStatuses: Record<string, { connected: boolean; lastError: string | null }> = {};
  for (const [model, device] of devices) {
    deviceStatuses[model] = {
      connected: isDeviceConnected(device),
      lastError: device.lastError,
    };
  }
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    devices: deviceStatuses,
  });
});

app.post('/command', async (req, res) => {
  const { model, command, value } = req.body;

  if (!model || !command) {
    res.status(400).json({ success: false, error: 'Missing model or command' });
    return;
  }

  if (!VALID_COMMANDS.has(command)) {
    res.status(400).json({ success: false, error: `Unknown command: ${command}` });
    return;
  }

  const device = getDevice(model);
  if (!device) {
    res.status(404).json({ success: false, error: `Device ${model} not found. Connect first.` });
    return;
  }

  const t0 = Date.now();
  try {
    const data = await routeCommandToDevice(device, command, value);
    const duration = Date.now() - t0;
    const success = !data.startsWith('ERR');
    res.json({ success, data, error: success ? undefined : data, duration });
  } catch (err: any) {
    const duration = Date.now() - t0;
    res.status(502).json({ success: false, error: err.message, duration });
  }
});

// ─── Mobile HTML Page ────────────────────────────────────────────────────────

const MOBILE_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>TechLaser Mobile Control</title>
<script src="/socket.io/socket.io.js"><\/script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-primary: #0a0f0d;
    --bg-secondary: #111916;
    --bg-card: #151d19;
    --bg-elevated: #1a2520;
    --border: #1e2e27;
    --border-bright: #2a3d33;
    --text-primary: #e8f5e9;
    --text-secondary: #7da88a;
    --text-muted: #4a6b55;
    --accent: #10b981;
    --accent-glow: rgba(16, 185, 129, 0.3);
    --amber: #f59e0b;
    --red: #ef4444;
    --red-glow: rgba(239, 68, 68, 0.3);
  }

  html, body {
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    min-height: 100dvh;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  body {
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) 12px env(safe-area-inset-bottom);
    max-width: 480px;
    margin: 0 auto;
    gap: 12px;
    padding-top: max(env(safe-area-inset-top), 12px);
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
  }
  .header h1 {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--accent);
    text-shadow: 0 0 12px var(--accent-glow);
  }
  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 10px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--red);
    box-shadow: 0 0 6px var(--red-glow);
    transition: background 0.3s, box-shadow 0.3s;
  }
  .status-dot.connected {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Device selector */
  .device-bar {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 2px 0;
  }
  .device-bar::-webkit-scrollbar { display: none; }
  .device-btn {
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    background: var(--bg-card);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.5px;
  }
  .device-btn.active {
    background: var(--bg-elevated);
    color: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 10px var(--accent-glow), inset 0 0 10px rgba(16, 185, 129, 0.05);
  }

  /* Telemetry */
  .telemetry {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .telem-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .telem-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .telem-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }
  .telem-value .unit {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 400;
    margin-left: 2px;
  }
  .telem-card.wide { grid-column: 1 / -1; }

  /* D-Pad */
  .dpad-container {
    display: flex;
    justify-content: center;
    padding: 8px 0;
  }
  .dpad {
    display: grid;
    grid-template-columns: repeat(3, 64px);
    grid-template-rows: repeat(3, 64px);
    gap: 6px;
  }
  .dpad-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-secondary);
    font-size: 22px;
    cursor: pointer;
    transition: all 0.1s;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .dpad-btn:active, .dpad-btn.pressing {
    background: var(--accent);
    color: var(--bg-primary);
    border-color: var(--accent);
    box-shadow: 0 0 16px var(--accent-glow);
    transform: scale(0.93);
  }
  .dpad-btn.stop-btn {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: var(--red);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .dpad-btn.stop-btn:active, .dpad-btn.stop-btn.pressing {
    background: var(--red);
    color: white;
    box-shadow: 0 0 16px var(--red-glow);
  }
  .dpad-btn.empty {
    background: transparent;
    border-color: transparent;
    cursor: default;
  }
  .dpad-center {
    grid-column: 2;
    grid-row: 2;
  }
  .dpad-up { grid-column: 2; grid-row: 1; }
  .dpad-up-left { grid-column: 1; grid-row: 1; }
  .dpad-up-right { grid-column: 3; grid-row: 1; }
  .dpad-left { grid-column: 1; grid-row: 2; }
  .dpad-right { grid-column: 3; grid-row: 2; }
  .dpad-down { grid-column: 2; grid-row: 3; }
  .dpad-down-left { grid-column: 1; grid-row: 3; }
  .dpad-down-right { grid-column: 3; grid-row: 3; }

  /* Speed Slider */
  .speed-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
  }
  .speed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .speed-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .speed-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    min-width: 30px;
    text-align: right;
  }
  .speed-track {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--border);
    border-radius: 3px;
    outline: none;
  }
  .speed-track::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-primary);
    box-shadow: 0 0 8px var(--accent-glow);
    cursor: pointer;
  }
  .speed-track::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-primary);
    box-shadow: 0 0 8px var(--accent-glow);
    cursor: pointer;
  }

  /* Action Buttons */
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .action-btn {
    padding: 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
  }
  .action-btn.primary {
    background: rgba(16, 185, 129, 0.12);
    color: var(--accent);
    border-color: rgba(16, 185, 129, 0.25);
  }
  .action-btn.primary:active {
    background: var(--accent);
    color: var(--bg-primary);
    box-shadow: 0 0 12px var(--accent-glow);
  }
  .action-btn.secondary {
    background: var(--bg-card);
    color: var(--text-secondary);
  }
  .action-btn.secondary:active {
    background: var(--bg-elevated);
    border-color: var(--border-bright);
  }

  /* Connect Button */
  .connect-section {
    display: flex;
    gap: 8px;
  }
  .connect-btn {
    flex: 1;
    padding: 14px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .connect-btn.connect {
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    box-shadow: 0 0 16px var(--accent-glow);
  }
  .connect-btn.connect:active {
    opacity: 0.8;
    transform: scale(0.98);
  }
  .connect-btn.disconnect {
    background: rgba(239, 68, 68, 0.12);
    color: var(--red);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .connect-btn.disconnect:active {
    background: var(--red);
    color: white;
  }

  /* Log */
  .log-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    max-height: 150px;
    overflow-y: auto;
  }
  .log-title {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .log-entry {
    font-size: 11px;
    color: var(--text-secondary);
    padding: 2px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 8px;
  }
  .log-entry:last-child { border-bottom: none; }
  .log-time { color: var(--text-muted); flex-shrink: 0; }
  .log-ok { color: var(--accent); }
  .log-err { color: var(--red); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 2px; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>TechLaser</h1>
    <div class="status-badge">
      <div class="status-dot" id="statusDot"></div>
      <span id="statusText">Disconnected</span>
    </div>
  </div>

  <!-- Device Selector -->
  <div class="device-bar" id="deviceBar">
    <button class="device-btn active" data-model="TL.0009">TL.0009</button>
    <button class="device-btn" data-model="TL.0250">TL.0250</button>
    <button class="device-btn" data-model="TL.0320">TL.0320</button>
    <button class="device-btn" data-model="TL.0400">TL.0400</button>
  </div>

  <!-- Telemetry -->
  <div class="telemetry">
    <div class="telem-card">
      <div class="telem-label">Azimuth</div>
      <div class="telem-value" id="azValue">--<span class="unit">\u00b0</span></div>
    </div>
    <div class="telem-card">
      <div class="telem-label">Elevation</div>
      <div class="telem-value" id="elValue">--<span class="unit">\u00b0</span></div>
    </div>
    <div class="telem-card wide">
      <div class="telem-label">Status</div>
      <div class="telem-value" id="statusValue" style="font-size:13px;color:var(--text-secondary)">No Device</div>
    </div>
  </div>

  <!-- D-Pad -->
  <div class="dpad-container">
    <div class="dpad">
      <button class="dpad-btn dpad-up-left" data-dir="up-left">\u2196</button>
      <button class="dpad-btn dpad-up" data-dir="up">\u2191</button>
      <button class="dpad-btn dpad-up-right" data-dir="up-right">\u2197</button>
      <button class="dpad-btn dpad-left" data-dir="left">\u2190</button>
      <button class="dpad-btn dpad-center stop-btn" data-dir="stop">STOP</button>
      <button class="dpad-btn dpad-right" data-dir="right">\u2192</button>
      <button class="dpad-btn dpad-down-left" data-dir="down-left">\u2199</button>
      <button class="dpad-btn dpad-down" data-dir="down">\u2193</button>
      <button class="dpad-btn dpad-down-right" data-dir="down-right">\u2198</button>
    </div>
  </div>

  <!-- Speed -->
  <div class="speed-section">
    <div class="speed-header">
      <span class="speed-label">Speed</span>
      <span class="speed-value" id="speedDisplay">5</span>
    </div>
    <input type="range" class="speed-track" id="speedSlider" min="1" max="10" value="5" step="1">
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="action-btn primary" id="homeBtn">\u2302 Home</button>
    <button class="action-btn primary" id="pingBtn">\u25cf Ping</button>
    <button class="action-btn secondary" id="preset1Btn">Preset 1</button>
    <button class="action-btn secondary" id="preset2Btn">Preset 2</button>
  </div>

  <!-- Connect -->
  <div class="connect-section">
    <button class="connect-btn connect" id="connectBtn">Connect Device</button>
  </div>

  <!-- Log -->
  <div class="log-section">
    <div class="log-title">Command Log</div>
    <div id="logEntries"></div>
  </div>

<script>
(function() {
  let currentModel = 'TL.0009';
  let deviceConnected = false;
  const socket = io({ path: '/socket.io' });

  // --- UI refs ---
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const azValue = document.getElementById('azValue');
  const elValue = document.getElementById('elValue');
  const statusValue = document.getElementById('statusValue');
  const speedDisplay = document.getElementById('speedDisplay');
  const speedSlider = document.getElementById('speedSlider');
  const logEntries = document.getElementById('logEntries');
  const connectBtn = document.getElementById('connectBtn');

  function setConnected(connected) {
    deviceConnected = connected;
    statusDot.classList.toggle('connected', connected);
    statusText.textContent = connected ? 'Connected' : 'Disconnected';
    if (connected) {
      connectBtn.textContent = 'Disconnect';
      connectBtn.classList.remove('connect');
      connectBtn.classList.add('disconnect');
    } else {
      connectBtn.textContent = 'Connect Device';
      connectBtn.classList.remove('disconnect');
      connectBtn.classList.add('connect');
      azValue.innerHTML = '--<span class="unit">\u00b0</span>';
      elValue.innerHTML = '--<span class="unit">\u00b0</span>';
      statusValue.textContent = 'No Device';
      statusValue.style.color = 'var(--text-secondary)';
    }
  }

  function addLog(cmd, ok) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    const cls = ok ? 'log-ok' : 'log-err';
    entry.innerHTML = '<span class="log-time">' + time + '</span><span class="' + cls + '">' + cmd + ' \u2192 ' + (ok ? 'OK' : 'FAIL') + '</span>';
    logEntries.prepend(entry);
    // Keep max 30 entries
    while (logEntries.children.length > 30) {
      logEntries.removeChild(logEntries.lastChild);
    }
  }

  // --- Socket.IO events ---
  socket.on('connect', function() {
    addLog('Socket connected', true);
  });

  socket.on('disconnect', function() {
    addLog('Socket disconnected', false);
    setConnected(false);
  });

  socket.on('device-status', function(data) {
    if (data.model === currentModel) {
      setConnected(data.status === 'connected');
      addLog(data.message || (data.status === 'connected' ? 'Device connected' : 'Device disconnected'), data.status === 'connected');
    }
  });

  socket.on('command-response', function(data) {
    addLog(data.command + (data.success ? '' : ': ' + (data.error || '')), data.success);
  });

  socket.on('telemetry', function(data) {
    if (data.model === currentModel) {
      azValue.innerHTML = (data.azimuth != null ? data.azimuth.toFixed(1) : '--') + '<span class="unit">\u00b0</span>';
      elValue.innerHTML = (data.elevation != null ? data.elevation.toFixed(1) : '--') + '<span class="unit">\u00b0</span>';
      statusValue.textContent = data.status || 'Unknown';
      statusValue.style.color = (data.status === 'Idle') ? 'var(--text-secondary)' : 'var(--accent)';
    }
  });

  // --- Device selector ---
  document.getElementById('deviceBar').addEventListener('click', function(e) {
    const btn = e.target.closest('.device-btn');
    if (!btn) return;
    document.querySelectorAll('.device-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentModel = btn.dataset.model;
    setConnected(false);
    // Query current status
    socket.emit('telemetry-request', { model: currentModel });
  });

  // --- Connect / Disconnect ---
  connectBtn.addEventListener('click', function() {
    if (deviceConnected) {
      socket.emit('disconnect-device', { model: currentModel });
    } else {
      socket.emit('connect-device', { model: currentModel });
    }
  });

  // --- D-Pad (touch + mouse) ---
  let moveInterval = null;
  let moveDirection = null;

  function startMove(dir) {
    if (dir === 'stop') {
      socket.emit('stop', { model: currentModel });
      return;
    }
    moveDirection = dir;
    // Send immediately
    socket.emit('move', { model: currentModel, direction: dir, speed: parseInt(speedSlider.value) });
    // Repeat while held
    clearInterval(moveInterval);
    moveInterval = setInterval(function() {
      if (moveDirection) {
        socket.emit('move', { model: currentModel, direction: moveDirection, speed: parseInt(speedSlider.value) });
      }
    }, 200);
  }

  function stopMove() {
    moveDirection = null;
    clearInterval(moveInterval);
    moveInterval = null;
    socket.emit('stop', { model: currentModel });
  }

  document.querySelectorAll('.dpad-btn').forEach(function(btn) {
    const dir = btn.dataset.dir;

    btn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      btn.classList.add('pressing');
      startMove(dir);
    }, { passive: false });

    btn.addEventListener('touchend', function(e) {
      e.preventDefault();
      btn.classList.remove('pressing');
      if (dir !== 'stop') stopMove();
    }, { passive: false });

    btn.addEventListener('touchcancel', function() {
      btn.classList.remove('pressing');
      if (dir !== 'stop') stopMove();
    });

    btn.addEventListener('mousedown', function(e) {
      e.preventDefault();
      btn.classList.add('pressing');
      startMove(dir);
    });

    btn.addEventListener('mouseup', function() {
      btn.classList.remove('pressing');
      if (dir !== 'stop') stopMove();
    });

    btn.addEventListener('mouseleave', function() {
      btn.classList.remove('pressing');
      if (dir !== 'stop' && moveDirection) stopMove();
    });
  });

  // --- Speed slider ---
  speedSlider.addEventListener('input', function() {
    const speed = parseInt(this.value);
    speedDisplay.textContent = speed;
    socket.emit('set-speed', { model: currentModel, speed: speed });
  });

  // --- Action buttons ---
  document.getElementById('homeBtn').addEventListener('click', function() {
    socket.emit('home', { model: currentModel });
  });

  document.getElementById('pingBtn').addEventListener('click', function() {
    socket.emit('command', { model: currentModel, command: 'PNG' });
  });

  document.getElementById('preset1Btn').addEventListener('click', function() {
    socket.emit('recall-preset', { model: currentModel, slot: 1 });
  });

  document.getElementById('preset2Btn').addEventListener('click', function() {
    socket.emit('recall-preset', { model: currentModel, slot: 2 });
  });

  // Prevent context menu on long press
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

})();
<\/script>
</body>
</html>`;

app.get('/', (_req, res) => {
  res.type('html').send(MOBILE_HTML);
});

// ─── Socket.IO Event Handlers ────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[Bridge] Socket.IO client connected: ${socket.id}`);

  // Connect to a PTU device via real TCP
  socket.on('connect-device', async (data: {
    model: string;
    tiltIp?: string;
    tiltPort?: number;
    panIp?: string;
    panPort?: number;
  }) => {
    const { model } = data;
    console.log(`[Bridge] connect-device: ${model}`);

    const device = getOrCreateDevice(model);
    const isDual = model === 'TL.0400';

    // Update IPs if provided
    if (data.tiltIp) device.tiltIp = data.tiltIp;
    if (data.tiltPort) device.tiltPort = data.tiltPort;
    if (data.panIp) device.panIp = data.panIp;
    if (data.panPort) device.panPort = data.panPort;

    // Clean up any existing connection
    destroyDeviceConnection(device);

    try {
      // Connect tilt socket
      const tiltSocket = await connectTcpSocket(device.tiltIp, device.tiltPort);
      device.tiltSocket = tiltSocket;

      // Configure keepalive on the socket
      tiltSocket.setKeepAlive(true, 10000);
      tiltSocket.on('error', (err) => {
        console.error(`[TCP] Tilt socket error (${model}): ${err.message}`);
        device.lastError = err.message;
        device.connected = false;
        device.status = 'error';
        io.emit('device-status', { model, status: 'error', message: `Tilt connection error: ${err.message}` });
      });
      tiltSocket.on('close', () => {
        if (device.connected) {
          console.warn(`[TCP] Tilt socket closed unexpectedly (${model})`);
          device.connected = false;
          device.status = 'disconnected';
          device.tiltSocket = null;
          // Also close pan if it exists
          if (device.panSocket) {
            try { device.panSocket.destroy(); } catch {}
            device.panSocket = null;
          }
          io.emit('device-status', { model, status: 'disconnected', message: 'Tilt connection lost' });
        }
      });

      // Connect pan socket for dual-axis devices
      if (isDual) {
        const panSocket = await connectTcpSocket(device.panIp, device.panPort);
        device.panSocket = panSocket;
        panSocket.setKeepAlive(true, 10000);
        panSocket.on('error', (err) => {
          console.error(`[TCP] Pan socket error (${model}): ${err.message}`);
          device.lastError = err.message;
          // Don't fully disconnect — pan error is recoverable
          io.emit('device-status', { model, status: 'error', message: `Pan connection error: ${err.message}` });
        });
        panSocket.on('close', () => {
          if (device.connected && device.panSocket === panSocket) {
            console.warn(`[TCP] Pan socket closed unexpectedly (${model})`);
            device.panSocket = null;
          }
        });
      }

      device.connected = true;
      device.connectedAt = Date.now();
      device.lastError = null;
      device.status = 'connected';

      // Read initial position
      try {
        const posResponse = await sendTcpCommand(device.tiltSocket, 'POS');
        const azMatch = posResponse.match(/AZ:([-\d.]+)/);
        const elMatch = posResponse.match(/EL:([-\d.]+)/);
        if (azMatch) device.azimuth = parseFloat(azMatch[1]);
        if (elMatch) device.elevation = parseFloat(elMatch[1]);
      } catch {
        // Non-critical — initial position read failed
      }

      socket.emit('device-status', {
        model,
        status: 'connected',
        message: `Connected to ${model} at ${device.tiltIp}:${device.tiltPort}${isDual ? ` + ${device.panIp}:${device.panPort}` : ''}`,
      });

      console.log(`[Bridge] Device ${model} connected via real TCP`);

    } catch (err: any) {
      destroyDeviceConnection(device);
      device.lastError = err.message;

      socket.emit('device-status', {
        model,
        status: 'error',
        message: `Failed to connect: ${err.message}`,
      });

      console.error(`[Bridge] Failed to connect ${model}: ${err.message}`);
    }
  });

  // Disconnect from a device
  socket.on('disconnect-device', (data: { model: string }) => {
    const { model } = data;
    const device = getDevice(model);
    console.log(`[Bridge] disconnect-device: ${model}`);

    if (device) {
      destroyDeviceConnection(device);
    }

    socket.emit('device-status', {
      model,
      status: 'disconnected',
      message: `Disconnected from ${model}`,
    });
  });

  // Generic command
  socket.on('command', async (data: { model: string; command: string; value?: string }) => {
    const { model, command, value } = data;
    const t0 = Date.now();
    console.log(`[Bridge] command: ${model} -> ${command}${value ? ` ${value}` : ''}`);

    const device = getDevice(model);
    if (!device) {
      socket.emit('command-response', {
        model, command, success: false,
        error: `Device ${model} not found. Connect first.`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, command, value);
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');

      socket.emit('command-response', {
        model, command, success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });

      socket.emit('log', {
        model, command,
        status: success ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      });

      // Update cached position for telemetry
      if (command === 'POS') {
        const azMatch = responseData.match(/AZ:([-\d.]+)/);
        const elMatch = responseData.match(/EL:([-\d.]+)/);
        if (azMatch) device.azimuth = parseFloat(azMatch[1]);
        if (elMatch) device.elevation = parseFloat(elMatch[1]);
      }

    } catch (err: any) {
      const duration = Date.now() - t0;
      socket.emit('command-response', {
        model, command, success: false,
        error: err.message || 'Unknown error',
        duration,
      });
      socket.emit('log', {
        model, command,
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Telemetry request
  socket.on('telemetry-request', async (data: { model: string }) => {
    const { model } = data;
    const device = getDevice(model);

    if (!device || !isDeviceConnected(device)) {
      socket.emit('telemetry', {
        model,
        azimuth: null,
        elevation: null,
        speed: device?.speed || 0,
        status: 'disconnected',
        connected: false,
      });
      return;
    }

    try {
      const posResponse = await sendTcpCommand(device.tiltSocket!, 'POS');
      let staResponse = '';
      try {
        staResponse = await sendTcpCommand(device.tiltSocket!, 'STA');
      } catch {
        // Status might not be supported by all devices
      }

      const azMatch = posResponse.match(/AZ:([-\d.]+)/);
      const elMatch = posResponse.match(/EL:([-\d.]+)/);
      const az = azMatch ? parseFloat(azMatch[1]) : device.azimuth;
      const el = elMatch ? parseFloat(elMatch[1]) : device.elevation;

      device.azimuth = az;
      device.elevation = el;

      // Parse speed from STA if available
      const spdMatch = staResponse.match(/SPD:(\d+)/);
      if (spdMatch) device.speed = parseInt(spdMatch[1]);

      // Determine movement status from STA
      const stMatch = staResponse.match(/ST:(\S+)/);
      const statusStr = stMatch ? stMatch[1] : 'Idle';
      const displayStatus = statusStr === 'IDLE' ? 'Idle' : (statusStr === 'MOVING' ? 'Moving' : statusStr);

      socket.emit('telemetry', {
        model,
        azimuth: az,
        elevation: el,
        speed: device.speed,
        status: displayStatus,
        connected: true,
      });

    } catch (err: any) {
      socket.emit('telemetry', {
        model,
        azimuth: device.azimuth,
        elevation: device.elevation,
        speed: device.speed,
        status: `Error: ${err.message}`,
        connected: false,
      });
    }
  });

  // Move (D-pad style)
  socket.on('move', async (data: { model: string; direction: string; speed?: number }) => {
    const { model, direction, speed } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: `MOVE ${direction}`, success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    // Set speed first if provided
    if (speed && speed !== device.speed) {
      try {
        await routeCommandToDevice(device, 'SPD', String(speed));
        device.speed = speed;
      } catch {
        // Non-critical
      }
    }

    const cmd = DIRECTION_MAP[direction];
    if (!cmd) {
      socket.emit('command-response', {
        model, command: `MOVE ${direction}`, success: false,
        error: `Unknown direction: ${direction}`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, cmd);
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: `MOVE ${direction}`, success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: `MOVE ${direction}`, success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Set speed
  socket.on('set-speed', async (data: { model: string; speed: number }) => {
    const { model, speed } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'SPD', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'SPD', String(speed));
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      if (success) device.speed = speed;
      socket.emit('command-response', {
        model, command: 'SPD', success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'SPD', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Stop
  socket.on('stop', async (data: { model: string }) => {
    const { model } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'STP', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'STP');
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: 'STP', success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'STP', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Recall preset
  socket.on('recall-preset', async (data: { model: string; slot: number }) => {
    const { model, slot } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'RPRS', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'RPRS', String(slot));
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: `RPRS ${slot}`, success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: `RPRS ${slot}`, success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Save preset
  socket.on('save-preset', async (data: { model: string; slot: number }) => {
    const { model, slot } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'SPRS', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'SPRS', String(slot));
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: `SPRS ${slot}`, success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: `SPRS ${slot}`, success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Go to position
  socket.on('goto', async (data: { model: string; azimuth: number; elevation: number }) => {
    const { model, azimuth, elevation } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'GOTO', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const value = `${azimuth},${elevation}`;
      const responseData = await routeCommandToDevice(device, 'GOTO', value);
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: `GOTO ${value}`, success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'GOTO', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Home
  socket.on('home', async (data: { model: string }) => {
    const { model } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'HOM', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'HOM');
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: 'HOM', success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'HOM', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Start swing
  socket.on('start-swing', async (data: {
    model: string;
    startAz: number;
    endAz: number;
    startEl: number;
    endEl: number;
    speed: number;
    cycleCount?: number;
  }) => {
    const { model, startAz, endAz, startEl, endEl, speed, cycleCount } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'SSWG', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const value = `${startAz} ${endAz} ${startEl} ${endEl} ${speed}${cycleCount != null ? ` ${cycleCount}` : ''}`;
      const responseData = await routeCommandToDevice(device, 'SSWG', value);
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: 'SSWG', success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'SSWG', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  // Stop swing
  socket.on('stop-swing', async (data: { model: string }) => {
    const { model } = data;
    const t0 = Date.now();

    const device = getDevice(model);
    if (!device || !isDeviceConnected(device)) {
      socket.emit('command-response', {
        model, command: 'ESWG', success: false,
        error: `Device ${model} not connected`,
        duration: Date.now() - t0,
      });
      return;
    }

    try {
      const responseData = await routeCommandToDevice(device, 'ESWG');
      const duration = Date.now() - t0;
      const success = !responseData.startsWith('ERR');
      socket.emit('command-response', {
        model, command: 'ESWG', success,
        data: responseData,
        error: success ? undefined : responseData,
        duration,
      });
    } catch (err: any) {
      socket.emit('command-response', {
        model, command: 'ESWG', success: false,
        error: err.message,
        duration: Date.now() - t0,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Bridge] Socket.IO client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`[Bridge] Socket.IO error (${socket.id}):`, error);
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Bridge] TechLaser Device Bridge running on port ${PORT}`);
  console.log(`[Bridge] HTTP REST: http://localhost:${PORT}/health, http://localhost:${PORT}/command`);
  console.log(`[Bridge] Socket.IO: ws://localhost:${PORT}/socket.io`);
  console.log(`[Bridge] Mobile UI:  http://localhost:${PORT}/`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[Bridge] Received ${signal}, shutting down...`);

  for (const [model, device] of devices) {
    console.log(`[Bridge] Closing TCP connections for ${model}...`);
    destroyDeviceConnection(device);
  }
  devices.clear();

  io.close(() => {
    httpServer.close(() => {
      console.log('[Bridge] Server closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));