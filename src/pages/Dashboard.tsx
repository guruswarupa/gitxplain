import React, { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { Activity, Code2, GitBranch, Zap } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { healthStatus, setHealthStatus, setHealthLoading, setError } = useAppStore();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'critical':
        return 'bg-red-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DevInsight Dashboard</h1>
        <p className="text-muted-foreground">Monitor your development environment and code quality</p>
      </div>

      {/* System Status Card */}
      <div className={`rounded-lg border p-6 mb-6 ${healthStatus ? getStatusBgColor(healthStatus.status) : 'bg-card'}`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">System Status</h2>
            {healthStatus ? (
              <div className="space-y-2">
                <div className={`text-lg font-bold capitalize ${getStatusColor(healthStatus.status)}`}>
                  {healthStatus.status}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-sm text-muted-foreground">System Load</div>
                    <div className="text-lg font-semibold">{healthStatus.systemLoad.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Memory Usage</div>
                    <div className="text-lg font-semibold">{healthStatus.memoryUsage.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Disk Usage</div>
                    <div className="text-lg font-semibold">{healthStatus.diskUsage.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Updated</div>
                    <div className="text-lg font-semibold text-xs">
                      {new Date(healthStatus.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">Loading system status...</div>
            )}
          </div>
          <button
            onClick={loadHealthStatus}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('health')}
          className="p-6 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <Activity className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Environment Health</h3>
          <p className="text-sm text-muted-foreground">Detailed system diagnostics</p>
        </button>

        <button
          onClick={() => onNavigate('review')}
          className="p-6 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <Code2 className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Code Review</h3>
          <p className="text-sm text-muted-foreground">Analyze and review code</p>
        </button>

        <button
          onClick={() => onNavigate('commits')}
          className="p-6 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <GitBranch className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Commit Story</h3>
          <p className="text-sm text-muted-foreground">Git repository insights</p>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="text-sm text-muted-foreground">Python</div>
          <div className="text-lg font-semibold">{healthStatus?.pythonVersion || 'N/A'}</div>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="text-sm text-muted-foreground">Node.js</div>
          <div className="text-lg font-semibold">{healthStatus?.nodeVersion || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
