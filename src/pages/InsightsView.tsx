/**
 * Insights Dashboard
 * Visualizes repository metrics and statistics
 */

import React from 'react';
import { BarChart3, TrendingUp, Users, FileCode, GitCommit } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';

export default function InsightsView() {
  const { insights, insightsLoading, currentProject, commits } = useCommitStoryStore();

  // Mock data for demonstration (will be replaced with real data)
  const mockInsights = {
    totalCommits: commits.length,
    commitsPerDay: [
      { date: '2024-01-01', count: 5 },
      { date: '2024-01-02', count: 8 },
      { date: '2024-01-03', count: 3 },
      { date: '2024-01-04', count: 12 },
      { date: '2024-01-05', count: 7 },
    ],
    commitTypeDistribution: [
      { type: 'feature', count: 45 },
      { type: 'fix', count: 32 },
      { type: 'docs', count: 15 },
      { type: 'refactor', count: 18 },
      { type: 'test', count: 10 },
    ],
    topAuthors: [
      { author: 'John Doe', commits: 67 },
      { author: 'Jane Smith', commits: 45 },
      { author: 'Bob Johnson', commits: 28 },
    ],
    activeFiles: [
      { file: 'src/components/App.tsx', changes: 25 },
      { file: 'src/services/api.ts', changes: 18 },
      { file: 'src/pages/Dashboard.tsx', changes: 15 },
    ],
  };

  if (!currentProject) {
    return null;
  }

  if (insightsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing repository...</p>
        </div>
      </div>
    );
  }

  const data = insights || mockInsights;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Repository Insights</h2>
        <p className="text-muted-foreground">
          Analytics and metrics for {currentProject.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<GitCommit className="w-5 h-5" />}
          label="Total Commits"
          value={data.totalCommits}
          color="blue"
        />
        <StatCard
          icon={<FileCode className="w-5 h-5" />}
          label="Files Changed"
          value={data.activeFiles?.length || 0}
          color="green"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Contributors"
          value={data.topAuthors?.length || 0}
          color="purple"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Avg Daily Commits"
          value={Math.round((data.commitsPerDay?.reduce((sum, d) => sum + d.count, 0) || 0) / (data.commitsPerDay?.length || 1))}
          color="orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commit Type Distribution */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Commit Type Distribution
          </h3>
          <div className="space-y-3">
            {data.commitTypeDistribution?.map((item) => {
              const total = data.commitTypeDistribution.reduce((sum, i) => sum + i.count, 0);
              const percentage = (item.count / total) * 100;
              
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{item.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Contributors
          </h3>
          <div className="space-y-3">
            {data.topAuthors?.map((author, index) => {
              const maxCommits = data.topAuthors[0].commits;
              const percentage = (author.commits / maxCommits) * 100;
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{author.author}</span>
                    <span className="text-sm text-muted-foreground">{author.commits} commits</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Active Files */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            Most Active Files
          </h3>
          <div className="space-y-3">
            {data.activeFiles?.map((file, index) => {
              const maxChanges = data.activeFiles[0].changes;
              const percentage = (file.changes / maxChanges) * 100;
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono truncate flex-1">{file.file}</span>
                    <span className="text-sm text-muted-foreground ml-2">{file.changes}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit Activity (Simple Bar Chart) */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="h-48 flex items-end justify-between gap-2">
            {data.commitsPerDay?.slice(-10).map((day, index) => {
              const maxCount = Math.max(...data.commitsPerDay.map(d => d.count));
              const height = (day.count / maxCount) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                      style={{ height: `${height}%` }}
                      title={`${day.count} commits`}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground text-center">
                    {day.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-700',
    green: 'bg-green-500/20 text-green-700',
    purple: 'bg-purple-500/20 text-purple-700',
    orange: 'bg-orange-500/20 text-orange-700',
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
