/**
 * Insights Dashboard
 * Visualizes repository metrics and statistics with report generation
 */

import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, FileCode, GitCommit, Download, FileText, Code, FileJson } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import { generateReport, ReportOptions, defaultOptions } from '../services/reportService';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const RECENT_ACTIVITY_DAYS = 14;

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function InsightsView() {
  const { insights, insightsLoading, currentProject, commits, stories } = useCommitStoryStore();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions>(defaultOptions);
  const [generating, setGenerating] = useState(false);

  // Calculate real insights from commits
  const realInsights = useMemo(() => {
    if (commits.length === 0) return null;
    
    // Group commits by author
    const authorCounts = new Map<string, number>();
    commits.forEach(c => {
      authorCounts.set(c.author, (authorCounts.get(c.author) || 0) + 1);
    });
    const topAuthors = [...authorCounts.entries()]
      .map(([author, commits]) => ({ author, commits }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);
    
    // Group commits by type
    const typeCounts = new Map<string, number>();
    commits.forEach(c => {
      const match = c.message.match(/^(feat|fix|docs|refactor|style|test|chore|build|ci|perf)(\(.+\))?:/i);
      const type = match ? match[1].toLowerCase() : 'other';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    const commitTypeDistribution = [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    // Group commits by day (local time)
    const dayCounts = new Map<string, number>();
    commits.forEach(c => {
      const date = toLocalDateKey(new Date(c.date));
      dayCounts.set(date, (dayCounts.get(date) || 0) + 1);
    });

    // Create a fixed recent timeline and fill missing days with zeroes.
    const today = new Date();
    const windowStart = addDays(today, -(RECENT_ACTIVITY_DAYS - 1));
    const commitsPerDay = Array.from({ length: RECENT_ACTIVITY_DAYS }, (_, index) => {
      const day = addDays(windowStart, index);
      const date = toLocalDateKey(day);
      return {
        date,
        label: `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`,
        count: dayCounts.get(date) || 0,
      };
    });
    
    // Get unique files
    const fileCounts = new Map<string, number>();
    commits.forEach(c => {
      c.files?.forEach(f => {
        fileCounts.set(f.path, (fileCounts.get(f.path) || 0) + 1);
      });
    });
    const activeFiles = [...fileCounts.entries()]
      .map(([file, changes]) => ({ file, changes }))
      .sort((a, b) => b.changes - a.changes)
      .slice(0, 5);
    
    return {
      totalCommits: commits.length,
      commitTypeDistribution,
      topAuthors,
      commitsPerDay,
      activeFiles: activeFiles.length > 0 ? activeFiles : [
        { file: 'Various files', changes: commits.length }
      ],
    };
  }, [commits]);

  const handleGenerateReport = async () => {
    if (!currentProject) return;
    
    setGenerating(true);
    try {
      const report = generateReport({
        project: currentProject,
        commits,
        stories,
        insights: null,
        generatedAt: new Date(),
        options: reportOptions,
      });
      
      // Download the report
      const mimeTypes = {
        markdown: 'text/markdown',
        html: 'text/html',
        json: 'application/json',
      };
      const extensions = {
        markdown: 'md',
        html: 'html',
        json: 'json',
      };
      
      const blob = new Blob([report], { type: mimeTypes[reportOptions.format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name}-report.${extensions[reportOptions.format]}`;
      a.click();
      URL.revokeObjectURL(url);
      
      setShowReportModal(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
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

  const data = realInsights || {
    totalCommits: 0,
    commitTypeDistribution: [],
    topAuthors: [],
    commitsPerDay: [],
    activeFiles: [],
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Repository Insights</h2>
          <p className="text-muted-foreground">
            Analytics and metrics for {currentProject.name}
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          disabled={commits.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Generate Report
        </button>
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
          value={Math.round((data.commitsPerDay?.reduce((sum, d) => sum + d.count, 0) || 0) / Math.max(data.commitsPerDay?.length || 1, 1))}
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
            {data.commitTypeDistribution?.length > 0 ? (
              data.commitTypeDistribution.map((item) => {
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
              })
            ) : (
              <p className="text-muted-foreground text-sm">No commit data available</p>
            )}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Contributors
          </h3>
          <div className="space-y-3">
            {data.topAuthors?.length > 0 ? (
              data.topAuthors.map((author, index) => {
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
              })
            ) : (
              <p className="text-muted-foreground text-sm">No contributor data available</p>
            )}
          </div>
        </div>

        {/* Most Active Files */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            Most Active Files
          </h3>
          <div className="space-y-3">
            {data.activeFiles?.length > 0 ? (
              data.activeFiles.map((file, index) => {
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
              })
            ) : (
              <p className="text-muted-foreground text-sm">No file data available</p>
            )}
          </div>
        </div>

        {/* Commit Activity */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Activity
          </h3>
          {data.commitsPerDay?.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.commitsPerDay} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value} commits`, 'Activity']}
                    labelFormatter={(label, payload) => {
                      const day = payload?.[0]?.payload as { date?: string } | undefined;
                      return day?.date || String(label);
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))' }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      offset={8}
                      className="fill-foreground text-xs"
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No activity data available</p>
          )}
        </div>
      </div>

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Generate Report</h3>
            
            {/* Format Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Report Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'markdown', label: 'Markdown', icon: FileText },
                  { id: 'html', label: 'HTML', icon: Code },
                  { id: 'json', label: 'JSON', icon: FileJson },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setReportOptions(prev => ({ ...prev, format: id as any }))}
                    className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-1 ${
                      reportOptions.format === id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Options */}
            <div className="mb-6 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reportOptions.includeCommitList}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeCommitList: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Include commit list</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reportOptions.includeStories}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeStories: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Include stories ({stories.length} available)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reportOptions.includeInsights}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeInsights: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Include insights & metrics</span>
              </label>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
    blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
    green: 'bg-green-500/20 text-green-700 dark:text-green-400',
    purple: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    orange: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
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
