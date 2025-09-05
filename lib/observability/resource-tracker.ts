import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { logger } from './logger';
import { getPerformanceMonitor } from './performance-monitor';
import { traceAsync } from './tracing';

const execAsync = promisify(exec);

export interface SystemMetrics {
  cpu: number;
  memory: number;
  eventLoopLag: number;
  diskIO?: DiskIOMetrics;
  network?: NetworkMetrics;
}

export interface DiskIOMetrics {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
  readLatency: number;
  writeLatency: number;
}

export interface NetworkMetrics {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  connections: number;
  errors: number;
}

export class ResourceTracker {
  private perfMonitor = getPerformanceMonitor();
  private previousDiskStats?: any;
  private previousNetworkStats?: any;
  private eventLoopLagInterval?: NodeJS.Timeout;
  private lastEventLoopCheck = Date.now();
  private maxEventLoopLag = 0;

  constructor() {
    this.startEventLoopMonitoring();
  }

  private startEventLoopMonitoring() {
    // Monitor event loop lag
    this.eventLoopLagInterval = setInterval(() => {
      const now = Date.now();
      const lag = now - this.lastEventLoopCheck - 100; // Expected 100ms interval
      this.maxEventLoopLag = Math.max(this.maxEventLoopLag, lag);
      this.lastEventLoopCheck = now;
    }, 100);
  }

  public async collectSystemMetrics(): Promise<SystemMetrics> {
    return traceAsync('resource.collect_metrics', async () => {
      const [cpu, memory, diskIO, network] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryUsage(),
        this.getDiskIOMetrics(),
        this.getNetworkMetrics()
      ]);

      const eventLoopLag = this.maxEventLoopLag;
      this.maxEventLoopLag = 0; // Reset for next interval

      const metrics: SystemMetrics = {
        cpu,
        memory,
        eventLoopLag,
        diskIO,
        network
      };

      // Record metrics
      await this.recordMetrics(metrics);

      return metrics;
    });
  }

  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  private async getMemoryUsage(): Promise<number> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;
    
    return usage;
  }

  private async getDiskIOMetrics(): Promise<DiskIOMetrics | undefined> {
    try {
      if (process.platform === 'linux') {
        return await this.getLinuxDiskIO();
      } else if (process.platform === 'darwin') {
        return await this.getDarwinDiskIO();
      } else if (process.platform === 'win32') {
        return await this.getWindowsDiskIO();
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to get disk I/O metrics');
    }
    return undefined;
  }

  private async getLinuxDiskIO(): Promise<DiskIOMetrics> {
    const diskStats = await readFile('/proc/diskstats', 'utf-8');
    const lines = diskStats.trim().split('\n');
    
    let totalReads = 0;
    let totalWrites = 0;
    let totalReadBytes = 0;
    let totalWriteBytes = 0;
    let totalReadTime = 0;
    let totalWriteTime = 0;

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 14) {
        // Skip partitions, only count whole devices
        if (parts[2].match(/^(sd[a-z]|nvme\d+n\d+)$/)) {
          totalReads += parseInt(parts[3]) || 0;
          totalReadBytes += (parseInt(parts[5]) || 0) * 512; // sectors to bytes
          totalReadTime += parseInt(parts[6]) || 0;
          totalWrites += parseInt(parts[7]) || 0;
          totalWriteBytes += (parseInt(parts[9]) || 0) * 512;
          totalWriteTime += parseInt(parts[10]) || 0;
        }
      }
    }

    const current = {
      readOps: totalReads,
      writeOps: totalWrites,
      readBytes: totalReadBytes,
      writeBytes: totalWriteBytes,
      readTime: totalReadTime,
      writeTime: totalWriteTime
    };

    if (this.previousDiskStats) {
      const deltaReads = current.readOps - this.previousDiskStats.readOps;
      const deltaWrites = current.writeOps - this.previousDiskStats.writeOps;
      const deltaReadBytes = current.readBytes - this.previousDiskStats.readBytes;
      const deltaWriteBytes = current.writeBytes - this.previousDiskStats.writeBytes;
      const deltaReadTime = current.readTime - this.previousDiskStats.readTime;
      const deltaWriteTime = current.writeTime - this.previousDiskStats.writeTime;

      this.previousDiskStats = current;

      return {
        readBytes: deltaReadBytes,
        writeBytes: deltaWriteBytes,
        readOps: deltaReads,
        writeOps: deltaWrites,
        readLatency: deltaReads > 0 ? deltaReadTime / deltaReads : 0,
        writeLatency: deltaWrites > 0 ? deltaWriteTime / deltaWrites : 0
      };
    }

    this.previousDiskStats = current;
    return {
      readBytes: 0,
      writeBytes: 0,
      readOps: 0,
      writeOps: 0,
      readLatency: 0,
      writeLatency: 0
    };
  }

  private async getDarwinDiskIO(): Promise<DiskIOMetrics> {
    try {
      const { stdout } = await execAsync('iostat -Id');
      const lines = stdout.trim().split('\n');
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.trim().split(/\s+/);

      if (parts.length >= 6) {
        return {
          readBytes: parseFloat(parts[0]) * 1024, // KB to bytes
          writeBytes: parseFloat(parts[1]) * 1024,
          readOps: 0, // Not available in basic iostat
          writeOps: 0,
          readLatency: 0,
          writeLatency: 0
        };
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to get Darwin disk I/O');
    }

    return {
      readBytes: 0,
      writeBytes: 0,
      readOps: 0,
      writeOps: 0,
      readLatency: 0,
      writeLatency: 0
    };
  }

  private async getWindowsDiskIO(): Promise<DiskIOMetrics> {
    try {
      const { stdout } = await execAsync(
        'wmic path Win32_PerfRawData_PerfDisk_PhysicalDisk get DiskReadBytesPerSec,DiskWriteBytesPerSec /format:csv'
      );
      
      const lines = stdout.trim().split('\n');
      if (lines.length > 2) {
        const dataLine = lines[2];
        const parts = dataLine.split(',');
        
        if (parts.length >= 3) {
          return {
            readBytes: parseInt(parts[1]) || 0,
            writeBytes: parseInt(parts[2]) || 0,
            readOps: 0,
            writeOps: 0,
            readLatency: 0,
            writeLatency: 0
          };
        }
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to get Windows disk I/O');
    }

    return {
      readBytes: 0,
      writeBytes: 0,
      readOps: 0,
      writeOps: 0,
      readLatency: 0,
      writeLatency: 0
    };
  }

  private async getNetworkMetrics(): Promise<NetworkMetrics | undefined> {
    try {
      if (process.platform === 'linux') {
        return await this.getLinuxNetworkMetrics();
      } else if (process.platform === 'darwin') {
        return await this.getDarwinNetworkMetrics();
      } else if (process.platform === 'win32') {
        return await this.getWindowsNetworkMetrics();
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to get network metrics');
    }
    return undefined;
  }

  private async getLinuxNetworkMetrics(): Promise<NetworkMetrics> {
    const netStats = await readFile('/proc/net/dev', 'utf-8');
    const lines = netStats.trim().split('\n');
    
    let totalRxBytes = 0;
    let totalTxBytes = 0;
    let totalRxPackets = 0;
    let totalTxPackets = 0;
    let totalErrors = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(':');
      if (parts.length === 2) {
        const iface = parts[0].trim();
        // Skip loopback
        if (iface === 'lo') continue;
        
        const stats = parts[1].trim().split(/\s+/);
        if (stats.length >= 11) {
          totalRxBytes += parseInt(stats[0]) || 0;
          totalRxPackets += parseInt(stats[1]) || 0;
          totalErrors += parseInt(stats[2]) || 0;
          totalErrors += parseInt(stats[3]) || 0;
          totalTxBytes += parseInt(stats[8]) || 0;
          totalTxPackets += parseInt(stats[9]) || 0;
          totalErrors += parseInt(stats[10]) || 0;
          totalErrors += parseInt(stats[11]) || 0;
        }
      }
    }

    // Get connection count
    let connections = 0;
    try {
      const tcpStats = await readFile('/proc/net/tcp', 'utf-8');
      connections = tcpStats.trim().split('\n').length - 1; // Exclude header
    } catch {
      // Ignore if can't read
    }

    const current = {
      rxBytes: totalRxBytes,
      txBytes: totalTxBytes,
      rxPackets: totalRxPackets,
      txPackets: totalTxPackets,
      errors: totalErrors,
      connections
    };

    if (this.previousNetworkStats) {
      const result = {
        rxBytes: current.rxBytes - this.previousNetworkStats.rxBytes,
        txBytes: current.txBytes - this.previousNetworkStats.txBytes,
        rxPackets: current.rxPackets - this.previousNetworkStats.rxPackets,
        txPackets: current.txPackets - this.previousNetworkStats.txPackets,
        connections: current.connections,
        errors: current.errors - this.previousNetworkStats.errors
      };

      this.previousNetworkStats = current;
      return result;
    }

    this.previousNetworkStats = current;
    return {
      rxBytes: 0,
      txBytes: 0,
      rxPackets: 0,
      txPackets: 0,
      connections,
      errors: 0
    };
  }

  private async getDarwinNetworkMetrics(): Promise<NetworkMetrics> {
    try {
      const { stdout } = await execAsync('netstat -ib');
      const lines = stdout.trim().split('\n');
      
      let totalRxBytes = 0;
      let totalTxBytes = 0;
      let totalRxPackets = 0;
      let totalTxPackets = 0;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 9 && !parts[0].includes('lo')) {
          totalRxPackets += parseInt(parts[4]) || 0;
          totalRxBytes += parseInt(parts[5]) || 0;
          totalTxPackets += parseInt(parts[6]) || 0;
          totalTxBytes += parseInt(parts[7]) || 0;
        }
      }

      // Get connection count
      const { stdout: connOut } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
      const connections = parseInt(connOut.trim()) || 0;

      return {
        rxBytes: totalRxBytes,
        txBytes: totalTxBytes,
        rxPackets: totalRxPackets,
        txPackets: totalTxPackets,
        connections,
        errors: 0
      };
    } catch (error) {
      logger.debug({ error }, 'Failed to get Darwin network metrics');
      return {
        rxBytes: 0,
        txBytes: 0,
        rxPackets: 0,
        txPackets: 0,
        connections: 0,
        errors: 0
      };
    }
  }

  private async getWindowsNetworkMetrics(): Promise<NetworkMetrics> {
    try {
      const { stdout } = await execAsync(
        'wmic path Win32_PerfRawData_Tcpip_NetworkInterface get BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec /format:csv'
      );
      
      const lines = stdout.trim().split('\n');
      let totalRxBytes = 0;
      let totalTxBytes = 0;
      let totalRxPackets = 0;
      let totalTxPackets = 0;

      for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 5) {
          totalRxBytes += parseInt(parts[1]) || 0;
          totalTxBytes += parseInt(parts[2]) || 0;
          totalRxPackets += parseInt(parts[3]) || 0;
          totalTxPackets += parseInt(parts[4]) || 0;
        }
      }

      return {
        rxBytes: totalRxBytes,
        txBytes: totalTxBytes,
        rxPackets: totalRxPackets,
        txPackets: totalTxPackets,
        connections: 0,
        errors: 0
      };
    } catch (error) {
      logger.debug({ error }, 'Failed to get Windows network metrics');
      return {
        rxBytes: 0,
        txBytes: 0,
        rxPackets: 0,
        txPackets: 0,
        connections: 0,
        errors: 0
      };
    }
  }

  private async recordMetrics(metrics: SystemMetrics) {
    const timestamp = Date.now();

    // Record CPU usage
    await this.perfMonitor.recordMetric({
      name: 'system.cpu.usage',
      value: metrics.cpu,
      unit: 'percent',
      timestamp
    });

    // Record memory usage
    await this.perfMonitor.recordMetric({
      name: 'system.memory.usage',
      value: metrics.memory,
      unit: 'percent',
      timestamp
    });

    // Record event loop lag
    await this.perfMonitor.recordMetric({
      name: 'system.eventloop.lag',
      value: metrics.eventLoopLag,
      unit: 'ms',
      timestamp
    });

    // Record disk I/O metrics
    if (metrics.diskIO) {
      await Promise.all([
        this.perfMonitor.recordMetric({
          name: 'system.disk.read.bytes',
          value: metrics.diskIO.readBytes,
          unit: 'bytes',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.disk.write.bytes',
          value: metrics.diskIO.writeBytes,
          unit: 'bytes',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.disk.read.latency',
          value: metrics.diskIO.readLatency,
          unit: 'ms',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.disk.write.latency',
          value: metrics.diskIO.writeLatency,
          unit: 'ms',
          timestamp
        })
      ]);
    }

    // Record network metrics
    if (metrics.network) {
      await Promise.all([
        this.perfMonitor.recordMetric({
          name: 'system.network.rx.bytes',
          value: metrics.network.rxBytes,
          unit: 'bytes',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.network.tx.bytes',
          value: metrics.network.txBytes,
          unit: 'bytes',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.network.connections',
          value: metrics.network.connections,
          unit: 'count',
          timestamp
        }),
        this.perfMonitor.recordMetric({
          name: 'system.network.errors',
          value: metrics.network.errors,
          unit: 'count',
          timestamp
        })
      ]);
    }
  }

  public cleanup() {
    if (this.eventLoopLagInterval) {
      clearInterval(this.eventLoopLagInterval);
    }
  }
}

// Singleton instance
let resourceTracker: ResourceTracker | null = null;

export function initializeResourceTracker(): ResourceTracker {
  if (!resourceTracker) {
    resourceTracker = new ResourceTracker();
    logger.info('Resource tracker initialized');
  }
  return resourceTracker;
}

export function getResourceTracker(): ResourceTracker {
  if (!resourceTracker) {
    throw new Error('Resource tracker not initialized');
  }
  return resourceTracker;
}