import { createServer } from 'http';
import { Server } from 'socket.io';
import { Socket as TcpSocket } from 'net';

const PORT = 3001;

// --- Types ---

type Direction =
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right'
  | 'stop';

interface SimState {
  azimuth: number;
  elevation: number;
  speed: number;
  moving: Direction | null;
  swingActive: boolean;
  swingDirection: 1 | -1;
  swingConfig: {
    startAz: number;
    endAz: number;
    startEl: number;
    endEl: number;
    speed: number;
  } | null;
  connectedAt: number;
  temperature: number;
  voltage: number;
}

interface DeviceConnection {
  model: string;
  tiltSocket: TcpSocket | null;
  panSocket: TcpSocket | null;
  simulated: boolean;
  simState: SimState;
}

// --- State ---

const devices = new Map<string, DeviceConnection>();

function getOrCreateDevice(model: string): DeviceConnection {
  let device = devices.get(model);
  if (!device) {
    device = {
      model,
      tiltSocket: null,
      panSocket: null,
      simulated: true, // Always simulation in sandbox
      simState: {
        azimuth: 0,
        elevation: 0,
        speed: 5,
        moving: null,
        swingActive: false,
        swingDirection: 1,
        swingConfig: null,
        connectedAt: Date.now(),
        temperature: 35 + Math.random() * 10,
        voltage: 11.5 + Math.random() * 1.5,
      },
    };
    devices.set(model, device);
  }
  return device;
}

// --- TCP Connect (real hardware, not used in simulation) ---

function connectTcp(ip: string, port: number): Promise<TcpSocket> {
  return new Promise((resolve, reject) => {
    const socket = new TcpSocket();
    socket.setTimeout(3000);
    socket.connect(port, ip, () => {
      resolve(socket);
    });
    socket.on('error', (err) => {
      reject(err);
    });
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

function sendTcpCommand(socket: TcpSocket, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, 2000);

    socket.once('data', (data) => {
      clearTimeout(timeout);
      resolve(data.toString().trim());
    });

    socket.write(command + '\r\n');
  });
}

// --- Simulation Logic ---

function simulateDelay(): Promise<void> {
  const delay = 50 + Math.random() * 150; // 50-200ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function simulateCommand(device: DeviceConnection, command: string, value?: string): string {
  const state = device.simState;

  switch (command) {
    case 'MU':
      state.moving = 'up';
      state.elevation = Math.min(90, state.elevation + state.speed * 0.5);
      return 'OK';
    case 'MD':
      state.moving = 'down';
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.5);
      return 'OK';
    case 'ML':
      state.moving = 'left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.5);
      return 'OK';
    case 'MR':
      state.moving = 'right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.5);
      return 'OK';
    case 'MUL':
      state.moving = 'up-left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.35);
      state.elevation = Math.min(90, state.elevation + state.speed * 0.35);
      return 'OK';
    case 'MUR':
      state.moving = 'up-right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.35);
      state.elevation = Math.min(90, state.elevation + state.speed * 0.35);
      return 'OK';
    case 'MDL':
      state.moving = 'down-left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.35);
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.35);
      return 'OK';
    case 'MDR':
      state.moving = 'down-right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.35);
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.35);
      return 'OK';
    case 'STP':
      state.moving = null;
      state.swingActive = false;
      state.swingConfig = null;
      return 'OK';
    case 'SPD': {
      const spd = parseInt(value || '5', 10);
      if (!isNaN(spd) && spd >= 1 && spd <= 10) {
        state.speed = spd;
        return 'OK';
      }
      return 'ERR INVALID_SPEED';
    }
    case 'POS':
      return `AZ:${state.azimuth.toFixed(1)} EL:${state.elevation.toFixed(1)}`;
    case 'GOTO': {
      if (value) {
        const parts = value.split(' ');
        const az = parseFloat(parts[0]);
        const el = parseFloat(parts[1]);
        if (!isNaN(az) && !isNaN(el)) {
          state.azimuth = Math.max(-180, Math.min(180, az));
          state.elevation = Math.max(-90, Math.min(90, el));
          state.moving = null;
          return 'OK';
        }
      }
      return 'ERR INVALID_POSITION';
    }
    case 'HOM':
      state.azimuth = 0;
      state.elevation = 0;
      state.moving = null;
      return 'OK';
    case 'PNG':
      return 'PONG';
    case 'STA':
      return `OK AZ:${state.azimuth.toFixed(1)} EL:${state.elevation.toFixed(1)} SPD:${state.speed} ST:${state.moving || 'IDLE'}`;
    case 'RST':
      state.azimuth = 0;
      state.elevation = 0;
      state.speed = 5;
      state.moving = null;
      state.swingActive = false;
      state.swingConfig = null;
      return 'OK REBOOTING';
    case 'SPRS': {
      const slot = parseInt(value || '1', 10);
      if (!isNaN(slot) && slot >= 1 && slot <= 16) {
        return `OK PRESET_SAVED:${slot}`;
      }
      return 'ERR INVALID_SLOT';
    }
    case 'RPRS': {
      const slot = parseInt(value || '1', 10);
      if (!isNaN(slot) && slot >= 1 && slot <= 16) {
        // Simulate recalling a preset - move to a "saved" position
        // In simulation, we'll generate a deterministic position based on slot
        state.azimuth = Math.sin(slot * 1.5) * 45;
        state.elevation = Math.cos(slot * 1.5) * 30;
        return `OK PRESET_RECALLED:${slot}`;
      }
      return 'ERR INVALID_SLOT';
    }
    case 'SSWG': {
      if (value) {
        const parts = value.split(' ');
        const startAz = parseFloat(parts[0]);
        const endAz = parseFloat(parts[1]);
        const startEl = parseFloat(parts[2]);
        const endEl = parseFloat(parts[3]);
        const spd = parseFloat(parts[4]);
        if (!isNaN(startAz) && !isNaN(endAz) && !isNaN(startEl) && !isNaN(endEl) && !isNaN(spd)) {
          state.swingConfig = { startAz, endAz, startEl, endEl, speed: spd };
          state.swingActive = true;
          state.swingDirection = 1;
          state.azimuth = startAz;
          state.elevation = startEl;
          state.moving = 'right';
          return 'OK SWING_STARTED';
        }
      }
      return 'ERR INVALID_SWING_PARAMS';
    }
    case 'ESWG':
      state.swingActive = false;
      state.swingConfig = null;
      state.moving = null;
      return 'OK SWING_STOPPED';
    default:
      return `ERR UNKNOWN_COMMAND:${command}`;
  }
}

// --- Periodic Telemetry Update (simulates movement continuation) ---

function updateSimState(device: DeviceConnection) {
  const state = device.simState;

  // Add jitter
  state.temperature = 35 + Math.random() * 10 + (state.moving ? 2 : 0);
  state.voltage = 11.5 + Math.random() * 1.5;

  if (state.swingActive && state.swingConfig) {
    const cfg = state.swingConfig;
    const step = cfg.speed * 0.3;
    state.azimuth += step * state.swingDirection;

    if (state.azimuth >= cfg.endAz) {
      state.azimuth = cfg.endAz;
      state.swingDirection = -1;
    } else if (state.azimuth <= cfg.startAz) {
      state.azimuth = cfg.startAz;
      state.swingDirection = 1;
    }

    // Interpolate elevation
    const azRange = cfg.endAz - cfg.startAz;
    if (azRange !== 0) {
      const progress = (state.azimuth - cfg.startAz) / azRange;
      state.elevation = cfg.startEl + (cfg.endEl - cfg.startEl) * progress;
    }

    return; // Swing mode overrides manual movement
  }

  if (state.moving) {
    const step = state.speed * 0.2;
    switch (state.moving) {
      case 'up':
        state.elevation = Math.min(90, state.elevation + step + (Math.random() - 0.5) * 0.1);
        break;
      case 'down':
        state.elevation = Math.max(-90, state.elevation - step + (Math.random() - 0.5) * 0.1);
        break;
      case 'left':
        state.azimuth = Math.max(-180, state.azimuth - step + (Math.random() - 0.5) * 0.1);
        break;
      case 'right':
        state.azimuth = Math.min(180, state.azimuth + step + (Math.random() - 0.5) * 0.1);
        break;
      case 'up-left':
        state.elevation = Math.min(90, state.elevation + step * 0.7 + (Math.random() - 0.5) * 0.1);
        state.azimuth = Math.max(-180, state.azimuth - step * 0.7 + (Math.random() - 0.5) * 0.1);
        break;
      case 'up-right':
        state.elevation = Math.min(90, state.elevation + step * 0.7 + (Math.random() - 0.5) * 0.1);
        state.azimuth = Math.min(180, state.azimuth + step * 0.7 + (Math.random() - 0.5) * 0.1);
        break;
      case 'down-left':
        state.elevation = Math.max(-90, state.elevation - step * 0.7 + (Math.random() - 0.5) * 0.1);
        state.azimuth = Math.max(-180, state.azimuth - step * 0.7 + (Math.random() - 0.5) * 0.1);
        break;
      case 'down-right':
        state.elevation = Math.max(-90, state.elevation - step * 0.7 + (Math.random() - 0.5) * 0.1);
        state.azimuth = Math.min(180, state.azimuth + step * 0.7 + (Math.random() - 0.5) * 0.1);
        break;
    }
  }
}

// --- Socket.IO Server ---

const httpServer = createServer();

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on('connection', (socket) => {
  console.log(`[Bridge] Client connected: ${socket.id}`);

  // Connect to a device (or simulate connection)
  socket.on('connect-device', async (data: { model: string; tiltIp: string; tiltPort: number; panIp: string; panPort: number }) => {
    const { model, tiltIp, tiltPort, panIp, panPort } = data;
    console.log(`[Bridge] Connect device request: ${model} (tilt: ${tiltIp}:${tiltPort}, pan: ${panIp}:${panPort})`);

    const device = getOrCreateDevice(model);
    const isDual = model === 'TL.0400';

    // Always use simulation in this environment
    device.simulated = true;
    device.simState.connectedAt = Date.now();
    device.tiltSocket = null;
    device.panSocket = null;

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100));

    socket.emit('device-status', {
      model,
      status: 'connected',
      message: `Connected to ${model} (Simulation Mode)`,
    });

    console.log(`[Bridge] Device ${model} connected (simulated)`);
  });

  // Disconnect from a device
  socket.on('disconnect-device', (data: { model: string }) => {
    const { model } = data;
    const device = devices.get(model);

    if (device) {
      if (device.tiltSocket) {
        device.tiltSocket.destroy();
        device.tiltSocket = null;
      }
      if (device.panSocket) {
        device.panSocket.destroy();
        device.panSocket = null;
      }
      device.simState.moving = null;
      device.simState.swingActive = false;
    }

    socket.emit('device-status', {
      model,
      status: 'disconnected',
      message: `Disconnected from ${model}`,
    });

    console.log(`[Bridge] Device ${model} disconnected`);
  });

  // Send a command to a device
  socket.on('command', async (data: { model: string; command: string; value?: string }) => {
    const { model, command, value } = data;
    const startTime = Date.now();
    console.log(`[Bridge] Command: ${model} -> ${command}${value ? ` ${value}` : ''}`);

    const device = getOrCreateDevice(model);

    try {
      await simulateDelay();

      let response: string;
      if (device.simulated) {
        response = simulateCommand(device, command, value);
      } else {
        // Real TCP command - send to tilt socket (and pan socket for TL.0400)
        if (device.tiltSocket) {
          response = await sendTcpCommand(device.tiltSocket, `${command}${value ? ` ${value}` : ''}`);
        } else {
          response = 'ERR NOT_CONNECTED';
        }
      }

      const duration = Date.now() - startTime;
      const success = !response.startsWith('ERR');

      socket.emit('command-response', {
        model,
        command,
        success,
        data: response,
        error: success ? undefined : response,
        duration,
      });

      // Also emit a log entry
      socket.emit('log', {
        model,
        command,
        status: success ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      });

    } catch (err: any) {
      const duration = Date.now() - startTime;
      socket.emit('command-response', {
        model,
        command,
        success: false,
        error: err.message || 'Unknown error',
        duration,
      });

      socket.emit('log', {
        model,
        command,
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Request telemetry
  socket.on('telemetry-request', (data: { model: string }) => {
    const { model } = data;
    const device = getOrCreateDevice(model);
    const state = device.simState;

    const uptime = Math.floor((Date.now() - state.connectedAt) / 1000);

    socket.emit('telemetry', {
      model,
      azimuth: parseFloat(state.azimuth.toFixed(2)),
      elevation: parseFloat(state.elevation.toFixed(2)),
      speed: state.speed,
      status: state.swingActive ? 'Swinging' : (state.moving ? 'Moving' : 'Idle'),
      temperature: parseFloat(state.temperature.toFixed(1)),
      voltage: parseFloat(state.voltage.toFixed(2)),
      uptime,
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Bridge] Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`[Bridge] Socket error (${socket.id}):`, error);
  });
});

// --- Periodic Telemetry Broadcast ---

const TELEMETRY_INTERVAL = 500; // 500ms

setInterval(() => {
  for (const [model, device] of devices) {
    if (device.simulated && (device.simState.moving || device.simState.swingActive)) {
      updateSimState(device);

      const state = device.simState;
      const uptime = Math.floor((Date.now() - state.connectedAt) / 1000);

      io.emit('telemetry', {
        model,
        azimuth: parseFloat(state.azimuth.toFixed(2)),
        elevation: parseFloat(state.elevation.toFixed(2)),
        speed: state.speed,
        status: state.swingActive ? 'Swinging' : (state.moving ? 'Moving' : 'Idle'),
        temperature: parseFloat(state.temperature.toFixed(1)),
        voltage: parseFloat(state.voltage.toFixed(2)),
        uptime,
      });
    }
  }
}, TELEMETRY_INTERVAL);

// --- Start Server ---

httpServer.listen(PORT, () => {
  console.log(`[Bridge] TechLaser Device Bridge running on port ${PORT}`);
});

// --- Graceful Shutdown ---

function shutdown(signal: string) {
  console.log(`[Bridge] Received ${signal}, shutting down...`);

  // Close all TCP connections
  for (const [model, device] of devices) {
    if (device.tiltSocket) device.tiltSocket.destroy();
    if (device.panSocket) device.panSocket.destroy();
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