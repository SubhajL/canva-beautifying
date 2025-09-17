import { Page, Request, Response } from '@playwright/test';

export interface CoreWebVitals {
  FCP: number;  // First Contentful Paint
  LCP: number;  // Largest Contentful Paint
  FID: number;  // First Input Delay
  CLS: number;  // Cumulative Layout Shift
  TTFB: number; // Time to First Byte
  TTI: number;  // Time to Interactive
}

export interface NetworkMetrics {
  requestCount: number;
  totalSize: number;
  totalDuration: number;
  cachedRequests: number;
  failedRequests: number;
  requestsByType: Record<string, number>;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface BundleMetrics {
  totalSize: number;
  usedSize: number;
  unusedPercentage: number;
  coverageByFile: Array<{
    url: string;
    size: number;
    used: number;
    unusedPercentage: number;
  }>;
}

export class PerformanceHelpers {
  private networkRequests: Map<string, Request> = new Map();
  private networkResponses: Map<string, Response> = new Map();
  private startTime: number = 0;

  constructor(private page: Page) {
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    this.startTime = Date.now();

    this.page.on('request', request => {
      this.networkRequests.set(request.url(), request);
    });

    this.page.on('response', response => {
      this.networkResponses.set(response.url(), response);
    });
  }

  async measurePageMetrics(url?: string): Promise<CoreWebVitals> {
    if (url) {
      await this.page.goto(url);
    }

    // Wait for page to be fully loaded
    await this.page.waitForLoadState('networkidle');

    return this.page.evaluate(() => {
      return new Promise<CoreWebVitals>((resolve) => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        
        const metrics: CoreWebVitals = {
          FCP: 0,
          LCP: 0,
          FID: 0,
          CLS: 0,
          TTFB: navigation.responseStart - navigation.requestStart,
          TTI: navigation.loadEventEnd - navigation.fetchStart
        };

        // Get FCP
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcp) {
          metrics.FCP = fcp.startTime;
        }

        // Observe LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
          metrics.LCP = lastEntry.renderTime || lastEntry.loadTime || 0;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe FID
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            metrics.FID = ((entries[0] as PerformanceEntry & { processingStart: number }).processingStart) - entries[0].startTime;
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Observe CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value: number };
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value;
            }
          }
          metrics.CLS = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Give observers time to collect data
        setTimeout(() => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
          resolve(metrics);
        }, 3000);
      });
    });
  }

  async analyzeBundleCoverage(): Promise<BundleMetrics> {
    const coverage = await this.page.coverage.stopJSCoverage();

    let totalSize = 0;
    let usedSize = 0;
    const coverageByFile: BundleMetrics['coverageByFile'] = [];

    for (const entry of coverage) {
      const fileSize = entry.source?.length || 0;
      totalSize += fileSize;

      // Collect all ranges from all functions
      const allRanges: Array<{ startOffset: number; endOffset: number }> = [];
      for (const func of entry.functions) {
        for (const range of func.ranges) {
          allRanges.push(range);
        }
      }

      // Merge overlapping ranges to avoid double counting
      const mergedRanges = this.mergeOverlappingRanges(allRanges);

      // Calculate used size from merged ranges
      let fileUsedSize = 0;
      for (const range of mergedRanges) {
        fileUsedSize += range.endOffset - range.startOffset;
      }

      // Ensure used size doesn't exceed file size (safety check)
      fileUsedSize = Math.min(fileUsedSize, fileSize);
      usedSize += fileUsedSize;

      if (entry.url.includes('/_next/') || entry.url.includes('/static/')) {
        coverageByFile.push({
          url: entry.url,
          size: fileSize,
          used: fileUsedSize,
          unusedPercentage: fileSize > 0 ? ((fileSize - fileUsedSize) / fileSize) * 100 : 0
        });
      }
    }

    // Restart coverage for next analysis
    await this.page.coverage.startJSCoverage();

    return {
      totalSize,
      usedSize,
      unusedPercentage: totalSize > 0 ? ((totalSize - usedSize) / totalSize) * 100 : 0,
      coverageByFile: coverageByFile.sort((a, b) => b.unusedPercentage - a.unusedPercentage)
    };
  }

  private mergeOverlappingRanges(ranges: Array<{ startOffset: number; endOffset: number }>): Array<{ startOffset: number; endOffset: number }> {
    if (ranges.length === 0) return [];

    // Sort ranges by start offset
    const sortedRanges = [...ranges].sort((a, b) => a.startOffset - b.startOffset);

    const merged: Array<{ startOffset: number; endOffset: number }> = [sortedRanges[0]];

    for (let i = 1; i < sortedRanges.length; i++) {
      const current = sortedRanges[i];
      const last = merged[merged.length - 1];

      // Check if current range overlaps with the last merged range
      if (current.startOffset <= last.endOffset) {
        // Merge the ranges by extending the end offset if needed
        last.endOffset = Math.max(last.endOffset, current.endOffset);
      } else {
        // No overlap, add as new range
        merged.push(current);
      }
    }

    return merged;
  }

  async trackMemoryUsage(): Promise<MemoryMetrics> {
    return this.page.evaluate((): MemoryMetrics => {
      if ('memory' in performance) {
        const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      };
    });
  }

  async interceptApiCalls(urlPattern?: string): Promise<NetworkMetrics> {
    const metrics: NetworkMetrics = {
      requestCount: 0,
      totalSize: 0,
      totalDuration: 0,
      cachedRequests: 0,
      failedRequests: 0,
      requestsByType: {}
    };

    for (const [url, request] of this.networkRequests) {
      if (urlPattern && !url.includes(urlPattern)) continue;

      metrics.requestCount++;

      const response = this.networkResponses.get(url);
      if (response) {
        // Check if cached
        const cacheHeader = response.headers()['cache-control'];
        if (response.fromCache() || (cacheHeader && cacheHeader.includes('max-age'))) {
          metrics.cachedRequests++;
        }

        // Check if failed
        if (!response.ok()) {
          metrics.failedRequests++;
        }

        // Track size
        const contentLength = parseInt(response.headers()['content-length'] || '0');
        metrics.totalSize += contentLength;

        // Track duration
        const timing = request.timing();
        if (timing) {
          metrics.totalDuration += timing.responseEnd;
        }

        // Track by type
        const contentType = response.headers()['content-type'] || 'unknown';
        const type = contentType.split('/')[0];
        metrics.requestsByType[type] = (metrics.requestsByType[type] || 0) + 1;
      }
    }

    return metrics;
  }

  async measureResourceLoadTimes(): Promise<Array<{
    url: string;
    type: string;
    duration: number;
    size: number;
  }>> {
    return this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      return resources
        .filter(resource => resource.duration > 0)
        .map(resource => ({
          url: resource.name,
          type: resource.initiatorType,
          duration: resource.duration,
          size: resource.transferSize || 0
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20); // Top 20 slowest resources
    });
  }

  async detectMemoryLeaks(
    action: () => Promise<void>,
    iterations = 5,
    threshold = 1.5
  ): Promise<{
    hasLeak: boolean;
    initialMemory: number;
    finalMemory: number;
    growthFactor: number;
  }> {
    // Force garbage collection if available
    await this.forceGarbageCollection();
    
    const initialMemory = await this.getHeapSize();
    
    for (let i = 0; i < iterations; i++) {
      await action();
      await this.page.waitForTimeout(100);
    }
    
    await this.forceGarbageCollection();
    await this.page.waitForTimeout(1000);
    
    const finalMemory = await this.getHeapSize();
    const growthFactor = finalMemory / initialMemory;
    
    return {
      hasLeak: growthFactor > threshold,
      initialMemory,
      finalMemory,
      growthFactor
    };
  }

  private async getHeapSize(): Promise<number> {
    const metrics = await this.trackMemoryUsage();
    return metrics.usedJSHeapSize;
  }

  private async forceGarbageCollection(): Promise<void> {
    await this.page.evaluate(() => {
      if ('gc' in window) {
        (window as unknown as { gc: () => void }).gc();
      }
    });
  }

  async analyzeRenderPerformance(): Promise<{
    fps: number;
    jank: number;
    longTasks: number;
  }> {
    return this.page.evaluate(() => {
      return new Promise((resolve) => {
        let fps = 0;
        let jank = 0;
        let longTasks = 0;
        let lastFrameTime = performance.now();
        let frameCount = 0;
        const frameTimes: number[] = [];

        // Monitor frames for 3 seconds
        const measureFrames = () => {
          const currentTime = performance.now();
          const deltaTime = currentTime - lastFrameTime;
          lastFrameTime = currentTime;
          
          frameTimes.push(deltaTime);
          frameCount++;
          
          // Detect jank (frame took > 50ms)
          if (deltaTime > 50) {
            jank++;
          }
          
          if (currentTime - frameTimes[0] < 3000) {
            requestAnimationFrame(measureFrames);
          } else {
            // Calculate average FPS
            fps = Math.round(frameCount / 3);
            resolve({ fps, jank, longTasks });
          }
        };

        // Monitor long tasks
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              longTasks++;
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });

        requestAnimationFrame(measureFrames);
      });
    });
  }

  clearMetrics(): void {
    this.networkRequests.clear();
    this.networkResponses.clear();
  }
}