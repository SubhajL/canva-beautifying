import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { EventEmitter } from 'events';
import { logger } from './logger';
import { getSLISLOTracker } from './sli-slo-tracker';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownMinutes: number;
}

export interface AlertCondition {
  type: 'span_duration' | 'span_error' | 'trace_duration' | 'attribute_value' | 'span_count';
  spanName?: string;
  operation?: string;
  threshold?: {
    operator: '<' | '<=' | '>' | '>=' | '=' | '!=';
    value: number;
  };
  attribute?: {
    key: string;
    operator: '<' | '<=' | '>' | '>=' | '=' | '!=' | 'contains' | 'not_contains';
    value: string | number;
  };
  window?: string; // Time window for aggregations
}

export interface AlertAction {
  type: 'log' | 'metric' | 'webhook' | 'email' | 'slack';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, any>;
  timestamp: Date;
}

export class TraceAlertingEngine extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private spanBuffer: Map<string, ReadableSpan[]> = new Map();
  private sliSloTracker = getSLISLOTracker();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Slow AI Operations
    this.addRule({
      id: 'slow-ai-operations',
      name: 'Slow AI Operations',
      description: 'Alert when AI operations take longer than expected',
      enabled: true,
      conditions: [{
        type: 'span_duration',
        operation: 'ai.*',
        threshold: { operator: '>', value: 30000 } // 30 seconds
      }],
      actions: [{
        type: 'log',
        config: { level: 'warning' }
      }, {
        type: 'metric',
        config: { 
          metric: 'alerts.slow_ai_operations',
          labels: { severity: 'warning' }
        }
      }],
      cooldownMinutes: 5
    });

    // Failed Database Operations
    this.addRule({
      id: 'database-errors',
      name: 'Database Operation Errors',
      description: 'Alert on database operation failures',
      enabled: true,
      conditions: [{
        type: 'span_error',
        operation: 'db.*'
      }],
      actions: [{
        type: 'log',
        config: { level: 'error' }
      }, {
        type: 'metric',
        config: {
          metric: 'alerts.database_errors',
          labels: { severity: 'error' }
        }
      }],
      cooldownMinutes: 1
    });

    // High Error Rate
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      enabled: true,
      conditions: [{
        type: 'span_count',
        attribute: {
          key: 'http.status_code',
          operator: '>=',
          value: 500
        },
        window: '5m',
        threshold: { operator: '>', value: 10 }
      }],
      actions: [{
        type: 'log',
        config: { level: 'critical' }
      }, {
        type: 'slack',
        config: { 
          channel: '#alerts',
          severity: 'critical'
        }
      }],
      cooldownMinutes: 15
    });

    // Memory Pressure
    this.addRule({
      id: 'memory-pressure',
      name: 'Memory Pressure Detected',
      description: 'Alert when memory usage is high during operations',
      enabled: true,
      conditions: [{
        type: 'attribute_value',
        attribute: {
          key: 'process.memory.usage',
          operator: '>',
          value: 90 // percentage
        }
      }],
      actions: [{
        type: 'log',
        config: { level: 'warning' }
      }, {
        type: 'metric',
        config: {
          metric: 'alerts.memory_pressure',
          labels: { severity: 'warning' }
        }
      }],
      cooldownMinutes: 10
    });

    // Cascading Failures
    this.addRule({
      id: 'cascading-failures',
      name: 'Cascading Failures Detected',
      description: 'Alert when multiple related operations fail',
      enabled: true,
      conditions: [{
        type: 'trace_duration',
        threshold: { operator: '>', value: 60000 } // 1 minute
      }, {
        type: 'span_count',
        attribute: {
          key: 'status.code',
          operator: '=',
          value: SpanStatusCode.ERROR
        },
        threshold: { operator: '>', value: 3 }
      }],
      actions: [{
        type: 'log',
        config: { level: 'critical' }
      }, {
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          severity: 'critical'
        }
      }],
      cooldownMinutes: 30
    });

    // SLO Burn Rate Alert (integrated with SLI/SLO tracker)
    this.addRule({
      id: 'slo-burn-rate',
      name: 'SLO Burn Rate Alert',
      description: 'Alert when SLO burn rate is too high',
      enabled: true,
      conditions: [{
        type: 'attribute_value',
        attribute: {
          key: 'slo.burn_rate',
          operator: '>',
          value: 10
        }
      }],
      actions: [{
        type: 'log',
        config: { level: 'error' }
      }, {
        type: 'email',
        config: {
          to: process.env.OPS_EMAIL,
          subject: 'SLO Burn Rate Alert'
        }
      }],
      cooldownMinutes: 60
    });
  }

  public addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
    logger.info({ ruleId: rule.id }, 'Added trace alerting rule');
  }

  public removeRule(ruleId: string) {
    this.rules.delete(ruleId);
    logger.info({ ruleId }, 'Removed trace alerting rule');
  }

  public async evaluateSpan(span: ReadableSpan) {
    const spanContext = span.spanContext();
    
    // Buffer spans by trace ID for trace-level rules
    const traceId = spanContext.traceId;
    if (!this.spanBuffer.has(traceId)) {
      this.spanBuffer.set(traceId, []);
    }
    this.spanBuffer.get(traceId)!.push(span);

    // Clean up old trace buffers (older than 5 minutes)
    this.cleanupOldTraces();

    // Evaluate each rule
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (this.isInCooldown(ruleId)) continue;

      try {
        const triggered = await this.evaluateRule(rule, span, traceId);
        if (triggered) {
          await this.triggerAlert(rule, span);
          this.setCooldown(ruleId, rule.cooldownMinutes);
        }
      } catch (error) {
        logger.error({ error, ruleId }, 'Failed to evaluate alert rule');
      }
    }
  }

  private async evaluateRule(
    rule: AlertRule,
    span: ReadableSpan,
    traceId: string
  ): Promise<boolean> {
    const results = await Promise.all(
      rule.conditions.map(condition => this.evaluateCondition(condition, span, traceId))
    );

    // All conditions must be met (AND logic)
    return results.every(result => result);
  }

  private async evaluateCondition(
    condition: AlertCondition,
    span: ReadableSpan,
    traceId: string
  ): Promise<boolean> {
    switch (condition.type) {
      case 'span_duration':
        return this.evaluateSpanDuration(condition, span);
      
      case 'span_error':
        return this.evaluateSpanError(condition, span);
      
      case 'trace_duration':
        return this.evaluateTraceDuration(condition, traceId);
      
      case 'attribute_value':
        return this.evaluateAttributeValue(condition, span);
      
      case 'span_count':
        return this.evaluateSpanCount(condition, traceId);
      
      default:
        return false;
    }
  }

  private evaluateSpanDuration(
    condition: AlertCondition,
    span: ReadableSpan
  ): boolean {
    if (!condition.threshold) return false;

    const duration = span.endTime[0] * 1000 + span.endTime[1] / 1e6 - 
                     (span.startTime[0] * 1000 + span.startTime[1] / 1e6);

    // Check if span name matches pattern
    if (condition.operation) {
      const pattern = new RegExp(condition.operation.replace('*', '.*'));
      if (!pattern.test(span.name)) return false;
    }

    return this.compareThreshold(duration, condition.threshold);
  }

  private evaluateSpanError(
    condition: AlertCondition,
    span: ReadableSpan
  ): boolean {
    // Check if span has error status
    if (span.status.code !== SpanStatusCode.ERROR) return false;

    // Check if operation matches pattern
    if (condition.operation) {
      const pattern = new RegExp(condition.operation.replace('*', '.*'));
      return pattern.test(span.name);
    }

    return true;
  }

  private evaluateTraceDuration(
    condition: AlertCondition,
    traceId: string
  ): boolean {
    if (!condition.threshold) return false;

    const spans = this.spanBuffer.get(traceId) || [];
    if (spans.length === 0) return false;

    // Find min start time and max end time
    let minStart = Infinity;
    let maxEnd = 0;

    for (const span of spans) {
      const startMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
      const endMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
      
      minStart = Math.min(minStart, startMs);
      maxEnd = Math.max(maxEnd, endMs);
    }

    const duration = maxEnd - minStart;
    return this.compareThreshold(duration, condition.threshold);
  }

  private evaluateAttributeValue(
    condition: AlertCondition,
    span: ReadableSpan
  ): boolean {
    if (!condition.attribute) return false;

    const value = span.attributes[condition.attribute.key];
    if (value === undefined) return false;

    return this.compareAttribute(value, condition.attribute);
  }

  private async evaluateSpanCount(
    condition: AlertCondition,
    traceId: string
  ): Promise<boolean> {
    if (!condition.threshold) return false;

    const spans = this.spanBuffer.get(traceId) || [];
    let count = 0;

    for (const span of spans) {
      if (condition.attribute) {
        const value = span.attributes[condition.attribute.key];
        if (value !== undefined && this.compareAttribute(value, condition.attribute)) {
          count++;
        }
      } else {
        count++;
      }
    }

    return this.compareThreshold(count, condition.threshold);
  }

  private compareThreshold(
    value: number,
    threshold: { operator: string; value: number }
  ): boolean {
    switch (threshold.operator) {
      case '<': return value < threshold.value;
      case '<=': return value <= threshold.value;
      case '>': return value > threshold.value;
      case '>=': return value >= threshold.value;
      case '=': return value === threshold.value;
      case '!=': return value !== threshold.value;
      default: return false;
    }
  }

  private compareAttribute(
    value: any,
    attribute: { key: string; operator: string; value: string | number }
  ): boolean {
    if (typeof value === 'number' && typeof attribute.value === 'number') {
      switch (attribute.operator) {
        case '<': return value < attribute.value;
        case '<=': return value <= attribute.value;
        case '>': return value > attribute.value;
        case '>=': return value >= attribute.value;
        case '=': return value === attribute.value;
        case '!=': return value !== attribute.value;
        default: return false;
      }
    } else {
      const strValue = String(value);
      const strCompare = String(attribute.value);
      
      switch (attribute.operator) {
        case '=': return strValue === strCompare;
        case '!=': return strValue !== strCompare;
        case 'contains': return strValue.includes(strCompare);
        case 'not_contains': return !strValue.includes(strCompare);
        default: return false;
      }
    }
  }

  private async triggerAlert(rule: AlertRule, span: ReadableSpan) {
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      severity: this.determineSeverity(rule),
      title: rule.name,
      description: rule.description,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      attributes: Object.fromEntries(
        Object.entries(span.attributes).map(([k, v]) => [k, v])
      ),
      timestamp: new Date()
    };

    // Execute actions
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, alert, span);
      } catch (error) {
        logger.error({ error, action: action.type }, 'Failed to execute alert action');
      }
    }

    // Emit alert event
    this.emit('alert', alert);
  }

  private determineSeverity(rule: AlertRule): Alert['severity'] {
    // Determine severity based on rule ID or conditions
    if (rule.id.includes('critical') || rule.name.toLowerCase().includes('critical')) {
      return 'critical';
    } else if (rule.id.includes('error') || rule.name.toLowerCase().includes('error')) {
      return 'error';
    } else if (rule.id.includes('warning') || rule.name.toLowerCase().includes('warning')) {
      return 'warning';
    }
    return 'info';
  }

  private async executeAction(action: AlertAction, alert: Alert, span: ReadableSpan) {
    switch (action.type) {
      case 'log':
        this.executeLogAction(action, alert);
        break;
      
      case 'metric':
        await this.executeMetricAction(action, alert);
        break;
      
      case 'webhook':
        await this.executeWebhookAction(action, alert);
        break;
      
      case 'email':
        await this.executeEmailAction(action, alert);
        break;
      
      case 'slack':
        await this.executeSlackAction(action, alert);
        break;
    }
  }

  private executeLogAction(action: AlertAction, alert: Alert) {
    const level = action.config.level || 'warn';
    const logData = {
      alert,
      type: 'trace_alert'
    };

    switch (level) {
      case 'debug':
        logger.debug(logData, alert.title);
        break;
      case 'info':
        logger.info(logData, alert.title);
        break;
      case 'warn':
        logger.warn(logData, alert.title);
        break;
      case 'error':
        logger.error(logData, alert.title);
        break;
      case 'fatal':
        logger.fatal(logData, alert.title);
        break;
    }
  }

  private async executeMetricAction(action: AlertAction, alert: Alert) {
    // Record alert as metric
    const metricName = action.config.metric || 'alerts.triggered';
    const labels = {
      rule_id: alert.ruleId,
      severity: alert.severity,
      ...action.config.labels
    };

    // Here you would record to your metrics system
    logger.info({
      metric: metricName,
      labels,
      value: 1
    }, 'Alert metric recorded');

    // Also record to SLI/SLO tracker if applicable
    await this.sliSloTracker.recordSLIData(metricName, 1, labels);
  }

  private async executeWebhookAction(action: AlertAction, alert: Alert) {
    if (!action.config.url) return;

    try {
      const response = await fetch(action.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(action.config.headers || {})
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          ...action.config.payload
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      logger.error({ error, url: action.config.url }, 'Failed to send webhook');
    }
  }

  private async executeEmailAction(action: AlertAction, alert: Alert) {
    // In a real implementation, you would use an email service
    logger.info({
      to: action.config.to,
      subject: action.config.subject || alert.title,
      alert
    }, 'Would send email alert');
  }

  private async executeSlackAction(action: AlertAction, alert: Alert) {
    if (!action.config.webhook_url && !process.env.SLACK_WEBHOOK_URL) return;

    const webhookUrl = action.config.webhook_url || process.env.SLACK_WEBHOOK_URL;
    const color = {
      info: '#36a64f',
      warning: '#ff9800',
      error: '#f44336',
      critical: '#d32f2f'
    }[alert.severity];

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: action.config.channel,
          attachments: [{
            color,
            title: alert.title,
            text: alert.description,
            fields: [
              {
                title: 'Severity',
                value: alert.severity,
                short: true
              },
              {
                title: 'Rule ID',
                value: alert.ruleId,
                short: true
              },
              {
                title: 'Trace ID',
                value: alert.traceId || 'N/A',
                short: true
              },
              {
                title: 'Time',
                value: alert.timestamp.toISOString(),
                short: true
              }
            ],
            footer: 'Trace Alerting System',
            ts: Math.floor(alert.timestamp.getTime() / 1000)
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send Slack alert');
    }
  }

  private isInCooldown(ruleId: string): boolean {
    const cooldownUntil = this.cooldowns.get(ruleId);
    if (!cooldownUntil) return false;
    
    if (Date.now() < cooldownUntil) {
      return true;
    }
    
    this.cooldowns.delete(ruleId);
    return false;
  }

  private setCooldown(ruleId: string, minutes: number) {
    this.cooldowns.set(ruleId, Date.now() + minutes * 60 * 1000);
  }

  private cleanupOldTraces() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    for (const [traceId, spans] of this.spanBuffer) {
      if (spans.length > 0) {
        const latestSpan = spans[spans.length - 1];
        const endTime = latestSpan.endTime[0] * 1000 + latestSpan.endTime[1] / 1e6;
        
        if (endTime < fiveMinutesAgo) {
          this.spanBuffer.delete(traceId);
        }
      }
    }
  }

  public getActiveAlerts(): Alert[] {
    // In a real implementation, you would store and retrieve active alerts
    return [];
  }

  public acknowledgeAlert(alertId: string) {
    // In a real implementation, you would mark alert as acknowledged
    logger.info({ alertId }, 'Alert acknowledged');
  }
}

// Singleton instance
let traceAlertingEngine: TraceAlertingEngine | null = null;

export function initializeTraceAlerting(): TraceAlertingEngine {
  if (!traceAlertingEngine) {
    traceAlertingEngine = new TraceAlertingEngine();
    logger.info('Trace alerting engine initialized');
  }
  return traceAlertingEngine;
}

export function getTraceAlertingEngine(): TraceAlertingEngine {
  if (!traceAlertingEngine) {
    throw new Error('Trace alerting engine not initialized');
  }
  return traceAlertingEngine;
}