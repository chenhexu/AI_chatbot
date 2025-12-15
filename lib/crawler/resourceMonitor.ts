import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

export interface ResourceStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  isHealthy: boolean;
}

export class ResourceMonitor {
  private cpuThreshold: number;
  private memoryThreshold: number;
  private diskThreshold: number;
  private dataFolder: string;

  constructor(
    dataFolder: string,
    cpuThreshold: number = 80, // Stop if CPU > 80% for too long
    memoryThreshold: number = 80, // Stop if RAM > 80%
    diskThreshold: number = 85 // Stop if disk > 85%
  ) {
    this.dataFolder = dataFolder;
    this.cpuThreshold = cpuThreshold;
    this.memoryThreshold = memoryThreshold;
    this.diskThreshold = diskThreshold;
  }

  /**
   * Get current CPU usage (average over last few seconds)
   */
  private getCpuUsage(): number {
    try {
      // Method 1: Use top command (most accurate)
      const result = execSync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'", {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const cpu = parseFloat(result.trim());
      if (!isNaN(cpu) && cpu >= 0 && cpu <= 100) {
        return cpu;
      }
    } catch (error) {
      // Fallback methods below
    }
    
    try {
      // Method 2: Use /proc/stat (more reliable)
      // Note: This requires two readings, but we'll use a simpler approach
      // For now, we'll use load average which is good enough for our purpose
    } catch (error) {
      // Fallback to load average
    }
    
    try {
      // Method 3: Use /proc/loadavg (less accurate but works)
      const loadavg = fs.readFileSync('/proc/loadavg', 'utf-8');
      const load = parseFloat(loadavg.split(' ')[0]);
      const cpuCount = os.cpus().length;
      // Load average of 1.0 = 100% CPU on single core
      // For multi-core, divide by core count
      const cpuPercent = Math.min(100, (load / cpuCount) * 100);
      return cpuPercent;
    } catch {
      // Can't determine, return 0 (assume OK to continue)
      return 0;
    }
  }

  /**
   * Get current memory usage percentage
   */
  private getMemoryUsage(): number {
    try {
      const memInfo = fs.readFileSync('/proc/meminfo', 'utf-8');
      const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)?.[1] || '0');
      const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)?.[1] || 
        memInfo.match(/MemFree:\s+(\d+)/)?.[1] || '0');
      
      if (memTotal === 0) return 0;
      const used = memTotal - memAvailable;
      return (used / memTotal) * 100;
    } catch (error) {
      // Fallback: use Node.js os module (less accurate)
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      return ((totalMem - freeMem) / totalMem) * 100;
    }
  }

  /**
   * Get disk usage percentage for the data folder's filesystem
   */
  private getDiskUsage(): number {
    try {
      // Get disk usage for the filesystem containing dataFolder
      const result = execSync(`df -h "${this.dataFolder}" | awk 'NR==2 {print $5}' | sed 's/%//'`, {
        encoding: 'utf-8',
        timeout: 5000
      });
      const usage = parseFloat(result.trim());
      return isNaN(usage) ? 0 : usage;
    } catch (error) {
      // Fallback: check home directory
      try {
        const result = execSync(`df -h ~ | awk 'NR==2 {print $5}' | sed 's/%//'`, {
          encoding: 'utf-8',
          timeout: 5000
        });
        const usage = parseFloat(result.trim());
        return isNaN(usage) ? 0 : usage;
      } catch {
        return 0; // Can't determine, assume OK
      }
    }
  }

  /**
   * Check all resources and return stats
   */
  checkResources(): ResourceStats {
    const cpuUsage = this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = this.getDiskUsage();

    const isHealthy = 
      cpuUsage < this.cpuThreshold &&
      memoryUsage < this.memoryThreshold &&
      diskUsage < this.diskThreshold;

    return {
      cpuUsage,
      memoryUsage,
      diskUsage,
      isHealthy
    };
  }

  /**
   * Check if resources are safe to continue crawling
   * Returns true if OK, false if should stop
   */
  shouldStop(): boolean {
    const stats = this.checkResources();
    return !stats.isHealthy;
  }

  /**
   * Get formatted resource report
   */
  getReport(): string {
    const stats = this.checkResources();
    return `📊 Resource Status:
  CPU: ${stats.cpuUsage.toFixed(1)}% (threshold: ${this.cpuThreshold}%)
  RAM: ${stats.memoryUsage.toFixed(1)}% (threshold: ${this.memoryThreshold}%)
  Disk: ${stats.diskUsage.toFixed(1)}% (threshold: ${this.diskThreshold}%)
  Status: ${stats.isHealthy ? '✅ Healthy' : '⚠️  WARNING - Resources high!'}`;
  }
}

