// TCP Connection Manager - Real device connections, NO simulation
import { Socket, createConnection } from 'net';
import { DEFAULT_DEVICE_CONFIGS, type DeviceModel, type DeviceConnectionConfig, buildCommand } from './device-types';

interface TcpConnection {
  model: DeviceModel;
  tiltSocket: Socket | null;
  panSocket: Socket | null;
  tiltConfig: { ip: string; port: number };
  panConfig: { ip: string; port: number };
  connected: boolean;
  lastError: string | null;
  lastActivity: number;
}

const COMMAND_TIMEOUT = 3000;
const CONNECTION_TIMEOUT = 5000;

class TcpManager {
  private connections = new Map<string, TcpConnection>();
  private pendingResolvers = new Map<string, { resolve: (data: string) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>();

  private getConnectionKey(model: string): string {
    return model;
  }

  private getOrCreateConnection(model: DeviceModel): TcpConnection {
    const key = this.getConnectionKey(model);
    let conn = this.connections.get(key);
    if (!conn) {
      const defaults = DEFAULT_DEVICE_CONFIGS[model];
      conn = {
        model,
        tiltSocket: null,
        panSocket: null,
        tiltConfig: { ip: defaults.config.tiltIp, port: defaults.config.tiltPort },
        panConfig: { ip: defaults.config.panIp, port: defaults.config.panPort },
        connected: false,
        lastError: null,
        lastActivity: 0,
      };
      this.connections.set(key, conn);
    }
    return conn;
  }

  // Store custom config from DB
  updateConfig(model: DeviceModel, config: DeviceConnectionConfig): void {
    const conn = this.getOrCreateConnection(model);
    const needsReconnect =
      conn.tiltConfig.ip !== config.tiltIp || conn.tiltConfig.port !== config.tiltPort ||
      conn.panConfig.ip !== config.panIp || conn.panConfig.port !== config.panPort;

    conn.tiltConfig = { ip: config.tiltIp, port: config.tiltPort };
    conn.panConfig = { ip: config.panIp, port: config.panPort };

    if (conn.connected && needsReconnect) {
      this.disconnect(model);
    }
  }

  connect(model: DeviceModel, config?: DeviceConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getOrCreateConnection(model);

      if (config) {
        conn.tiltConfig = { ip: config.tiltIp, port: config.tiltPort };
        conn.panConfig = { ip: config.panIp, port: config.panPort };
      }

      if (conn.connected) {
        resolve();
        return;
      }

      const isDualAxis = model === 'TL.0400';
      let pendingSockets = isDualAxis ? 2 : 1;
      let errors: string[] = [];

      const checkDone = () => {
        pendingSockets--;
        if (pendingSockets === 0) {
          if (errors.length === 0) {
            conn.connected = true;
            conn.lastError = null;
            conn.lastActivity = Date.now();
            resolve();
          } else {
            // Clean up any partial connections
            if (conn.tiltSocket) { conn.tiltSocket.destroy(); conn.tiltSocket = null; }
            if (conn.panSocket) { conn.panSocket.destroy(); conn.panSocket = null; }
            conn.connected = false;
            conn.lastError = errors.join('; ');
            reject(new Error(conn.lastError));
          }
        }
      };

      // Create Tilt socket
      const tiltSocket = createConnection({ host: conn.tiltConfig.ip, port: conn.tiltConfig.port, timeout: CONNECTION_TIMEOUT });
      tiltSocket.on('connect', () => {
        conn.tiltSocket = tiltSocket;
        console.log(`[TCP] Tilt connected: ${conn.tiltConfig.ip}:${conn.tiltConfig.port}`);
        checkDone();
      });
      tiltSocket.on('error', (err) => {
        errors.push(`Tilt: ${err.message}`);
        checkDone();
      });
      tiltSocket.on('timeout', () => {
        tiltSocket.destroy();
        errors.push('Tilt: connection timeout');
        checkDone();
      });
      tiltSocket.on('data', (data) => {
        conn.lastActivity = Date.now();
        this.handleData(model, 'tilt', data.toString());
      });
      tiltSocket.on('close', () => {
        if (conn.connected) {
          console.log(`[TCP] Tilt disconnected: ${model}`);
          conn.connected = false;
          conn.tiltSocket = null;
        }
      });

      // Create Pan socket (separate for TL.0400, shared for others)
      if (isDualAxis) {
        const panSocket = createConnection({ host: conn.panConfig.ip, port: conn.panConfig.port, timeout: CONNECTION_TIMEOUT });
        panSocket.on('connect', () => {
          conn.panSocket = panSocket;
          console.log(`[TCP] Pan connected: ${conn.panConfig.ip}:${conn.panConfig.port}`);
          checkDone();
        });
        panSocket.on('error', (err) => {
          errors.push(`Pan: ${err.message}`);
          checkDone();
        });
        panSocket.on('timeout', () => {
          panSocket.destroy();
          errors.push('Pan: connection timeout');
          checkDone();
        });
        panSocket.on('data', (data) => {
          conn.lastActivity = Date.now();
          this.handleData(model, 'pan', data.toString());
        });
        panSocket.on('close', () => {
          if (conn.connected) {
            console.log(`[TCP] Pan disconnected: ${model}`);
            conn.connected = false;
            conn.panSocket = null;
          }
        });
      } else {
        // Non-dual: pan and tilt share the same socket
        conn.panSocket = null; // Will be set to tiltSocket after connect
        tiltSocket.on('connect', () => {
          conn.panSocket = conn.tiltSocket;
        });
      }
    });
  }

  disconnect(model: DeviceModel): void {
    const conn = this.connections.get(this.getConnectionKey(model));
    if (conn) {
      if (conn.tiltSocket) { conn.tiltSocket.destroy(); conn.tiltSocket = null; }
      if (conn.panSocket && conn.panSocket !== conn.tiltSocket) { conn.panSocket.destroy(); conn.panSocket = null; }
      conn.connected = false;
      conn.lastError = null;
    }
  }

  isConnected(model: DeviceModel): boolean {
    const conn = this.connections.get(this.getConnectionKey(model));
    return conn?.connected === true && conn.tiltSocket !== null;
  }

  getStatus(model: DeviceModel): { connected: boolean; lastError: string | null; lastActivity: number } {
    const conn = this.connections.get(this.getConnectionKey(model));
    return {
      connected: conn?.connected ?? false,
      lastError: conn?.lastError ?? null,
      lastActivity: conn?.lastActivity ?? 0,
    };
  }

  // Send command and wait for response
  async sendCommand(model: DeviceModel, command: string, value?: string | number): Promise<string> {
    const conn = this.connections.get(this.getConnectionKey(model));

    if (!conn || !conn.connected || !conn.tiltSocket) {
      return 'ERR NOT_CONNECTED';
    }

    const cmdStr = buildCommand(command, value);
    const requestId = `${model}:${Date.now()}:${Math.random()}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResolvers.delete(requestId);
        resolve('ERR TIMEOUT');
      }, COMMAND_TIMEOUT);

      this.pendingResolvers.set(requestId, { resolve, reject, timeout });

      // Send to tilt socket (and pan socket if separate)
      try {
        if (conn.tiltSocket && !conn.tiltSocket.destroyed) {
          conn.tiltSocket.write(cmdStr);
        }

        // For TL.0400, send pan commands to pan socket
        const isPanCommand = command.startsWith('SET_ACC_P') || command.startsWith('SET_DEC_P') ||
          command.startsWith('SET_LIM_P') || command.startsWith('SET_SMODE_P');
        if (conn.panSocket && conn.panSocket !== conn.tiltSocket && !conn.panSocket.destroyed) {
          if (isPanCommand) {
            conn.panSocket.write(cmdStr);
          }
        }
      } catch (err: any) {
        this.pendingResolvers.delete(requestId);
        clearTimeout(timeout);
        conn.connected = false;
        conn.lastError = err.message;
        resolve(`ERR SEND_FAILED: ${err.message}`);
      }
    });
  }

  private handleData(model: string, axis: 'tilt' | 'pan', data: string): void {
    // Try to match response to a pending request
    // Simple approach: resolve the oldest pending request for this model
    for (const [key, resolver] of this.pendingResolvers) {
      if (key.startsWith(model)) {
        clearTimeout(resolver.timeout);
        this.pendingResolvers.delete(key);
        resolver.resolve(data.trim());
        return;
      }
    }
    // No pending request - could be unsolicited telemetry
    console.log(`[TCP] Unsolicited data from ${model} (${axis}):`, data.trim());
  }

  // Send a raw command string (for device bridge compatibility)
  async sendRaw(model: DeviceModel, rawCommand: string): Promise<string> {
    const conn = this.connections.get(this.getConnectionKey(model));

    if (!conn || !conn.connected || !conn.tiltSocket) {
      return 'ERR NOT_CONNECTED';
    }

    const requestId = `${model}:${Date.now()}:${Math.random()}`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingResolvers.delete(requestId);
        resolve('ERR TIMEOUT');
      }, COMMAND_TIMEOUT);

      this.pendingResolvers.set(requestId, { resolve, reject: () => {}, timeout });

      try {
        const cmdStr = rawCommand.endsWith('\r\n') ? rawCommand : rawCommand + '\r\n';
        conn.tiltSocket.write(cmdStr);
      } catch (err: any) {
        this.pendingResolvers.delete(requestId);
        clearTimeout(timeout);
        resolve(`ERR SEND_FAILED: ${err.message}`);
      }
    });
  }

  // Disconnect all
  disconnectAll(): void {
    for (const [model] of this.connections) {
      this.disconnect(model as DeviceModel);
    }
  }
}

// Global singleton
let tcpManager: TcpManager | null = null;

export function getTcpManager(): TcpManager {
  if (!tcpManager) {
    tcpManager = new TcpManager();
  }
  return tcpManager;
}

export { TcpManager };