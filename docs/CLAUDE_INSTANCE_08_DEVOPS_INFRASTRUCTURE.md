# Claude Instance 08: DevOps & Infrastructure Specialist

## Role Overview
You are responsible for setting up and maintaining the infrastructure required for the distributed architecture. This includes Redis cluster configuration, Docker environments, CI/CD pipelines, monitoring stack, and deployment strategies.

## Core Responsibilities

### 1. Redis Infrastructure Setup

**Docker Compose Configuration:**

Create `docker/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Redis Cluster Setup
  redis-master:
    image: redis:7-alpine
    container_name: beautifyai-redis-master
    command: redis-server /usr/local/etc/redis/redis.conf
    ports:
      - "6379:6379"
    volumes:
      - ./redis/master.conf:/usr/local/etc/redis/redis.conf
      - redis-master-data:/data
    networks:
      - beautifyai-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      
  redis-replica-1:
    image: redis:7-alpine
    container_name: beautifyai-redis-replica-1
    command: redis-server /usr/local/etc/redis/redis.conf --slaveof redis-master 6379
    depends_on:
      redis-master:
        condition: service_healthy
    volumes:
      - ./redis/replica.conf:/usr/local/etc/redis/redis.conf
      - redis-replica-1-data:/data
    networks:
      - beautifyai-network
      
  redis-replica-2:
    image: redis:7-alpine
    container_name: beautifyai-redis-replica-2
    command: redis-server /usr/local/etc/redis/redis.conf --slaveof redis-master 6379
    depends_on:
      redis-master:
        condition: service_healthy
    volumes:
      - ./redis/replica.conf:/usr/local/etc/redis/redis.conf
      - redis-replica-2-data:/data
    networks:
      - beautifyai-network
      
  redis-sentinel-1:
    image: redis:7-alpine
    container_name: beautifyai-redis-sentinel-1
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    depends_on:
      - redis-master
    volumes:
      - ./redis/sentinel.conf:/usr/local/etc/redis/sentinel.conf
    networks:
      - beautifyai-network
      
  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    container_name: beautifyai-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    networks:
      - beautifyai-network
      
  grafana:
    image: grafana/grafana:latest
    container_name: beautifyai-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana-data:/var/lib/grafana
    ports:
      - "3001:3000"
    networks:
      - beautifyai-network
      
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: beautifyai-jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    networks:
      - beautifyai-network
      
  # Log aggregation
  loki:
    image: grafana/loki:latest
    container_name: beautifyai-loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - beautifyai-network

volumes:
  redis-master-data:
  redis-replica-1-data:
  redis-replica-2-data:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  beautifyai-network:
    driver: bridge
```

**Redis Configuration Files:**

Create `docker/redis/master.conf`:

```conf
# Redis Master Configuration
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# Replication
replica-read-only yes
replica-serve-stale-data yes

# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
io-threads 4
io-threads-do-reads yes

# Security
requirepass ${REDIS_PASSWORD}
```

### 2. Kubernetes Configuration

Create `k8s/redis-statefulset.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: beautifyai
data:
  redis.conf: |
    maxmemory 2gb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: beautifyai
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      initContainers:
      - name: config
        image: redis:7-alpine
        command: 
        - sh
        - -c
        - |
          cp /mnt/config/redis.conf /data/redis.conf
          echo "replica-announce-ip ${HOSTNAME}.redis.beautifyai.svc.cluster.local" >> /data/redis.conf
          echo "replica-announce-port 6379" >> /data/redis.conf
        volumeMounts:
        - name: config
          mountPath: /mnt/config
        - name: data
          mountPath: /data
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /data/redis.conf
        ports:
        - containerPort: 6379
          name: redis
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          tcpSocket:
            port: redis
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: redis-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### 3. GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
          
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: |
        npm run test:unit
        npm run test:integration
      env:
        REDIS_URL: redis://localhost:6379
        
    - name: Check code coverage
      run: npm run test:coverage
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    outputs:
      image: ${{ steps.image.outputs.image }}
      
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha
          
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        
    - name: Output image
      id: image
      run: echo "image=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${GITHUB_SHA::7}" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Vercel
      env:
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      run: |
        npm i -g vercel
        vercel pull --yes --environment=production --token=$VERCEL_TOKEN
        vercel build --prod --token=$VERCEL_TOKEN
        vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
        
    - name: Update Redis Cluster
      run: |
        # Update Redis configuration in production
        # This would typically update your infrastructure as code
        echo "Redis cluster configuration updated"
        
    - name: Run smoke tests
      run: |
        npm run test:smoke
      env:
        APP_URL: ${{ secrets.PRODUCTION_URL }}
        
    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: 'Production deployment completed'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
      if: always()
```

### 4. Monitoring Setup

Create `docker/monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - "alerts/*.yml"

scrape_configs:
  # Application metrics
  - job_name: 'beautifyai-app'
    static_configs:
      - targets: ['host.docker.internal:9464']
    metrics_path: '/metrics'
    
  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
        
  # Node exporter
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
        
  # Jaeger metrics
  - job_name: 'jaeger'
    static_configs:
      - targets: ['jaeger:14269']
```

Create `docker/monitoring/grafana/dashboards/beautifyai-overview.json`:

```json
{
  "dashboard": {
    "title": "BeautifyAI System Overview",
    "panels": [
      {
        "title": "AI Request Rate",
        "targets": [
          {
            "expr": "rate(ai_requests_total[5m])",
            "legendFormat": "{{model}}"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))",
            "legendFormat": "{{type}}"
          }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "targets": [
          {
            "expr": "circuit_breaker_state",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Redis Memory Usage",
        "targets": [
          {
            "expr": "redis_memory_used_bytes / redis_memory_max_bytes",
            "legendFormat": "{{instance}}"
          }
        ]
      }
    ]
  }
}
```

### 5. Infrastructure as Code

Create `terraform/redis.tf`:

```hcl
# Upstash Redis for production
resource "upstash_redis_database" "main" {
  database_name = "beautifyai-prod"
  region        = "us-west-1"
  tls           = true
  eviction      = true
  auto_scale    = true
  
  # Enable persistence
  persistence = "aof"
  
  # Set memory limits
  memory_limit = 2048 # 2GB
}

# Create read replicas
resource "upstash_redis_database" "replica_east" {
  database_name = "beautifyai-replica-east"
  region        = "us-east-1"
  primary_region = upstash_redis_database.main.region
  tls           = true
}

# Output connection details
output "redis_endpoint" {
  value = upstash_redis_database.main.endpoint
  sensitive = true
}

output "redis_password" {
  value = upstash_redis_database.main.password
  sensitive = true
}
```

### 6. Deployment Scripts

Create `scripts/deploy-redis-update.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting Redis configuration update...${NC}"

# Check environment
if [[ -z "${ENVIRONMENT:-}" ]]; then
  echo -e "${RED}Error: ENVIRONMENT not set${NC}"
  exit 1
fi

# Validate Redis connectivity
echo -e "${YELLOW}Testing Redis connectivity...${NC}"
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Backup current config
echo -e "${YELLOW}Backing up current configuration...${NC}"
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG GET "*" > redis-backup-$(date +%Y%m%d-%H%M%S).conf

# Apply new configuration
echo -e "${YELLOW}Applying new configuration...${NC}"
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG SET maxmemory 2gb
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG SET timeout 300

# Verify configuration
echo -e "${YELLOW}Verifying configuration...${NC}"
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG GET maxmemory-policy
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG GET maxmemory

# Persist configuration
echo -e "${YELLOW}Persisting configuration...${NC}"
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD CONFIG REWRITE

echo -e "${GREEN}Redis configuration update complete!${NC}"
```

### 7. Health Check Scripts

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

# Health check endpoints
APP_URL="${APP_URL:-http://localhost:5000}"
REDIS_HOST="${REDIS_HOST:-localhost}"
METRICS_PORT="${METRICS_PORT:-9464}"

# Check application health
check_app() {
  response=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/api/health)
  if [[ $response -eq 200 ]]; then
    echo "✅ Application is healthy"
    return 0
  else
    echo "❌ Application health check failed (HTTP $response)"
    return 1
  fi
}

# Check Redis
check_redis() {
  if redis-cli -h $REDIS_HOST ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
    
    # Check memory usage
    used=$(redis-cli -h $REDIS_HOST info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    echo "   Memory usage: $used"
    return 0
  else
    echo "❌ Redis health check failed"
    return 1
  fi
}

# Check metrics endpoint
check_metrics() {
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$METRICS_PORT/metrics)
  if [[ $response -eq 200 ]]; then
    echo "✅ Metrics endpoint is healthy"
    return 0
  else
    echo "❌ Metrics endpoint health check failed (HTTP $response)"
    return 1
  fi
}

# Run all checks
echo "Running health checks..."
echo "========================"

check_app
app_status=$?

check_redis
redis_status=$?

check_metrics
metrics_status=$?

echo "========================"

# Exit with error if any check failed
if [[ $app_status -ne 0 || $redis_status -ne 0 || $metrics_status -ne 0 ]]; then
  echo "❌ Some health checks failed"
  exit 1
else
  echo "✅ All systems healthy"
  exit 0
fi
```

## Environment Configuration

### Development Environment

Create `.env.development`:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=devpassword
REDIS_TLS_ENABLED=false

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Feature Flags
ENABLE_DISTRIBUTED_STATE=true
ENABLE_CIRCUIT_BREAKER=true
ENABLE_CACHE_LAYER=true
ENABLE_TRACING=true
```

### Production Environment

Create `.env.production`:

```bash
# Redis Configuration (Upstash)
REDIS_URL=rediss://default:${UPSTASH_REDIS_PASSWORD}@${UPSTASH_REDIS_ENDPOINT}:6379
REDIS_TLS_ENABLED=true

# Monitoring (Cloud providers)
PROMETHEUS_ENDPOINT=${PROMETHEUS_CLOUD_ENDPOINT}
GRAFANA_CLOUD_API_KEY=${GRAFANA_CLOUD_KEY}
JAEGER_ENDPOINT=${JAEGER_CLOUD_ENDPOINT}

# Feature Flags
ENABLE_DISTRIBUTED_STATE=true
ENABLE_CIRCUIT_BREAKER=true
ENABLE_CACHE_LAYER=true
ENABLE_TRACING=true
```

## Coordination with Other Instances

### Instance 1 (State Management)
- Provide Redis connection strings
- Set up Redis Sentinel for HA
- Configure connection pooling

### Instance 4 (Observability)
- Deploy monitoring stack
- Configure metric exporters
- Set up alerting rules

### Instance 6 (Testing)
- Provide test containers setup
- Configure CI/CD test stages
- Set up load testing infrastructure

### Instance 7 (Database)
- Coordinate migration deployments
- Set up database backups
- Configure connection pooling

## Daily Tasks

### Morning
1. Check overnight deployments
2. Review infrastructure alerts
3. Verify backup completions

### Continuous
1. Monitor resource usage
2. Update deployment scripts
3. Respond to infrastructure issues

### End of Day
1. Review deployment metrics
2. Update runbooks
3. Plan next day's changes

## Success Criteria

1. **Reliability:**
- 99.9% uptime for Redis
- Automated failover < 30s
- Zero-downtime deployments

2. **Performance:**
- Redis latency < 5ms p99
- Deployment time < 5 minutes
- Monitoring lag < 30s

3. **Security:**
- All connections TLS encrypted
- Secrets properly managed
- Regular security updates

Remember: Infrastructure is the foundation. Make it rock solid!