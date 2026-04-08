import React, { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';

export default function EnvironmentHealth() {
  const { healthStatus, healthLoading, setHealthStatus, setHealthLoading, setError } = useAppStore();

  useEffect(() => {
    loadHealthStatus();
  }, []);

  const loadHealthStatus = async () => {
    setHealthLoading(true);
    try {
      const status = await apiService.getHealthStatus();
      setHealthStatus(status);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setHealthLoading(false);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-600" />;
    }
  };

  const renderMetricGauge = (label: string, value: number, max: number = 100) => {
    const percentage = (value / max) * 100;
    let color = 'bg-green-500';
    if (percentage > 75) color = 'bg-red-500';
    else if (percentage > 50) color = 'bg-yellow-500';

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-semibold">{value.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  if (healthLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin">
          <RefreshCw className="w-8 h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Environment Health</h1>
          <p className="text-muted-foreground">System resources and environment diagnostics</p>
        </div>
        <button
          onClick={loadHealthStatus}
          disabled={healthLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {healthStatus && (
        <div className="space-y-6">
          {/* Overall Status */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-4 mb-4">
              {getHealthIcon(healthStatus.status)}
              <div>
                <div className="text-xl font-bold capitalize">{healthStatus.status}</div>
                <div className="text-sm text-muted-foreground">
                  Last checked: {new Date(healthStatus.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* System Metrics */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-4">System Metrics</h2>
            <div className="space-y-4">
              {renderMetricGauge('System Load', healthStatus.systemLoad)}
              {renderMetricGauge('Memory Usage', healthStatus.memoryUsage)}
              {renderMetricGauge('Disk Usage', healthStatus.diskUsage)}
            </div>
          </div>

          {/* Environment Info */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-4">Environment Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Python Version</div>
                <div className="font-mono text-lg">{healthStatus.pythonVersion}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Node.js Version</div>
                <div className="font-mono text-lg">{healthStatus.nodeVersion}</div>
              </div>
            </div>
          </div>

          {/* Status Legend */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-3">Status Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm">Healthy - All systems operating normally</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm">Warning - Some metrics exceed safe thresholds</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm">Critical - System health requires attention</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
