import { EventEmitter } from 'events';
import { logger } from './logger';
import { getPerformanceMonitor } from './performance-monitor';
import { getPerformanceAnalyzer } from './performance-analyzer';
import type { PerformanceBottleneck } from './performance-analyzer';
import type { PerformanceMetric } from './performance-monitor';

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: 'performance' | 'health' | 'resource' | 'error' | 'security';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'threshold' | 'pattern' | 'anomaly';
  metric?: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration?: number; // How long condition must be true (ms)
  };
  severity: 'info' | 'warning' | 'critical';
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'log' | 'webhook' | 'email' | 'slack' | 'pagerduty';
  config: Record<string, any>;
}

export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private ruleStates: Map<string, { triggered: boolean; since?: number }> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  private initializeDefaultRules() {
    // CPU usage rules
    this.addRule({
      id: 'cpu-critical',
      name: 'Critical CPU Usage',
      enabled: true,
      type: 'threshold',
      metric: 'system.cpu.usage',
      condition: {
        operator: '>',
        value: 90,
        duration: 60000 // 1 minute
      },
      severity: 'critical',
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }
      ]
    });

    this.addRule({
      id: 'cpu-warning',
      name: 'High CPU Usage',
      enabled: true,
      type: 'threshold',
      metric: 'system.cpu.usage',
      condition: {
        operator: '>',
        value: 75,
        duration: 300000 // 5 minutes
      },
      severity: 'warning',
      actions: [
        { type: 'log', config: {} }
      ]
    });

    // Memory usage rules
    this.addRule({
      id: 'memory-critical',
      name: 'Critical Memory Usage',
      enabled: true,
      type: 'threshold',
      metric: 'system.memory.usage',
      condition: {
        operator: '>',
        value: 95,
        duration: 30000 // 30 seconds
      },
      severity: 'critical',
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }
      ]
    });

    // Event loop lag rules
    this.addRule({
      id: 'eventloop-critical',
      name: 'Critical Event Loop Lag',
      enabled: true,
      type: 'threshold',
      metric: 'system.eventloop.lag',
      condition: {
        operator: '>',
        value: 100,
        duration: 60000 // 1 minute
      },
      severity: 'critical',
      actions: [
        { type: 'log', config: {} }
      ]
    });

    // HTTP response time rules
    this.addRule({
      id: 'http-slow',
      name: 'Slow HTTP Responses',
      enabled: true,
      type: 'threshold',
      metric: 'http.request.duration',
      condition: {
        operator: '>',
        value: 5000,
        duration: 300000 // 5 minutes
      },
      severity: 'warning',
      actions: [
        { type: 'log', config: {} }
      ]
    });

    // AI operation rules
    this.addRule({
      id: 'ai-failures',
      name: 'High AI Failure Rate',
      enabled: true,
      type: 'threshold',
      metric: 'ai.failure.rate',
      condition: {
        operator: '>',
        value: 10, // 10% failure rate
        duration: 300000 // 5 minutes
      },
      severity: 'warning',
      actions: [
        { type: 'log', config: {} }
      ]
    });
  }

  private startMonitoring() {
    // Listen for performance bottlenecks
    const performanceAnalyzer = getPerformanceAnalyzer();
    performanceAnalyzer.on('bottleneck', (bottlenecks: PerformanceBottleneck[]) => {
      for (const bottleneck of bottlenecks) {
        this.createAlert({
          level: bottleneck.severity,
          type: 'performance',
          title: `Performance Bottleneck: ${bottleneck.type}`,
          message: bottleneck.recommendation,
          metadata: {
            metric: bottleneck.metric,
            value: bottleneck.value,
            threshold: bottleneck.threshold
          }
        });
      }
    });

    // Start rule checking
    this.checkInterval = setInterval(() => {
      this.checkRules();
    }, this.CHECK_INTERVAL);

    logger.info('Alert manager started');
  }

  private async checkRules() {
    const performanceMonitor = getPerformanceMonitor();
    
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled || rule.type !== 'threshold' || !rule.metric) continue;

      try {
        // Get latest metric value
        const metrics = await performanceMonitor.getMetrics(rule.metric, {
          limit: 1
        }) as PerformanceMetric[];

        if (metrics.length === 0) continue;

        const currentValue = metrics[0].value;
        const conditionMet = this.evaluateCondition(currentValue, rule.condition);

        const ruleState = this.ruleStates.get(ruleId) || { triggered: false };

        if (conditionMet) {
          if (!ruleState.triggered) {
            // Condition just became true
            ruleState.triggered = true;
            ruleState.since = Date.now();
            this.ruleStates.set(ruleId, ruleState);
          } else if (rule.condition.duration) {
            // Check if duration requirement is met
            const duration = Date.now() - (ruleState.since || 0);
            if (duration >= rule.condition.duration) {
              // Fire alert
              this.createAlert({
                level: rule.severity,
                type: 'performance',
                title: rule.name,
                message: `${rule.metric} ${rule.condition.operator} ${rule.condition.value} for ${Math.round(duration / 1000)}s`,
                metadata: {
                  rule: rule.id,
                  metric: rule.metric,
                  value: currentValue,
                  threshold: rule.condition.value
                }
              });

              // Execute actions
              this.executeActions(rule.actions, rule, currentValue);

              // Reset state to prevent duplicate alerts
              ruleState.since = Date.now();
              this.ruleStates.set(ruleId, ruleState);
            }
          }
        } else {
          // Condition no longer met
          if (ruleState.triggered) {
            ruleState.triggered = false;
            delete ruleState.since;
            this.ruleStates.set(ruleId, ruleState);
          }
        }
      } catch (error) {
        logger.error({ err: error, rule: rule.id }, 'Failed to check alert rule');
      }
    }
  }

  private evaluateCondition(value: number, condition: AlertRule['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.value;
      case '<': return value < condition.value;
      case '>=': return value >= condition.value;
      case '<=': return value <= condition.value;
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      default: return false;
    }
  }

  private async executeActions(actions: AlertAction[], rule: AlertRule, value: number) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.warn({
              alert: rule.name,
              rule: rule.id,
              metric: rule.metric,
              value,
              threshold: rule.condition.value
            }, 'Alert triggered');
            break;

          case 'webhook':
            if (action.config.url) {
              await this.sendWebhook(action.config.url, {
                alert: rule.name,
                severity: rule.severity,
                metric: rule.metric,
                value,
                threshold: rule.condition.value,
                timestamp: new Date().toISOString()
              });
            }
            break;

          case 'slack':
            await this.sendSlackAlert(action.config, rule, value);
            break;

          case 'email':
            await this.sendEmailAlert(action.config, rule, value);
            break;

          case 'pagerduty':
            await this.sendPagerDutyAlert(action.config, rule, value);
            break;
        }
      } catch (error) {
        logger.error({ 
          err: error, 
          action: action.type,
          rule: rule.id 
        }, 'Failed to execute alert action');
      }
    }
  }

  private async sendWebhook(url: string, data: any) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      logger.error({ err: error, url }, 'Failed to send webhook');
      throw error;
    }
  }

  private async sendSlackAlert(config: any, rule: AlertRule, value: number) {
    if (!config.webhookUrl) return;

    const color = rule.severity === 'critical' ? '#FF0000' : 
                 rule.severity === 'warning' ? '#FFA500' : '#00FF00';

    await this.sendWebhook(config.webhookUrl, {
      attachments: [{
        color,
        title: rule.name,
        text: `Alert: ${rule.metric} = ${value} (threshold: ${rule.condition.value})`,
        footer: 'BeautifyAI Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    });
  }

  private async sendEmailAlert(config: any, rule: AlertRule, value: number) {
    // Implementation would depend on your email service
    logger.info({ rule: rule.id, config }, 'Would send email alert');
  }

  private async sendPagerDutyAlert(config: any, rule: AlertRule, value: number) {
    // Implementation would depend on PagerDuty integration
    logger.info({ rule: rule.id, config }, 'Would send PagerDuty alert');
  }

  public createAlert(options: {
    level: Alert['level'];
    type: Alert['type'];
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...options,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);

    // Log the alert
    const logMethod = alert.level === 'critical' ? 'error' : 
                     alert.level === 'warning' ? 'warn' : 'info';
    
    logger[logMethod]({
      alert: {
        id: alert.id,
        level: alert.level,
        type: alert.type,
        title: alert.title
      },
      metadata: alert.metadata
    }, alert.message);

    return alert;
  }

  public acknowledgeAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', alert);
    }
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.emit('alert:resolved', alert);
    }
  }

  public getAlerts(options?: {
    unacknowledged?: boolean;
    unresolved?: boolean;
    level?: Alert['level'];
    type?: Alert['type'];
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (options?.unacknowledged) {
      alerts = alerts.filter(a => !a.acknowledged);
    }

    if (options?.unresolved) {
      alerts = alerts.filter(a => !a.resolvedAt);
    }

    if (options?.level) {
      alerts = alerts.filter(a => a.level === options.level);
    }

    if (options?.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    // Sort by timestamp descending
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  public addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string) {
    this.rules.delete(ruleId);
    this.ruleStates.delete(ruleId);
  }

  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Singleton instance
let alertManager: AlertManager | null = null;

export function initializeAlertManager(): AlertManager {
  if (!alertManager) {
    alertManager = new AlertManager();
  }
  return alertManager;
}

export function getAlertManager(): AlertManager {
  if (!alertManager) {
    throw new Error('Alert manager not initialized');
  }
  return alertManager;
}