import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { Send, AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';

export default function CodeReview() {
  const [code, setCode] = useState('');
  const [filePath, setFilePath] = useState('');
  const { codeReviewResults, codeReviewLoading, setCodeReviewResults, setCodeReviewLoading, setError } =
    useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter some code to review');
      return;
    }

    setCodeReviewLoading(true);
    try {
      const results = await apiService.submitCodeReview(code, filePath || 'code.py');
      setCodeReviewResults(results);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setCodeReviewLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-l-red-600 bg-red-50';
      case 'warning':
        return 'border-l-yellow-600 bg-yellow-50';
      case 'info':
        return 'border-l-blue-600 bg-blue-50';
      default:
        return 'border-l-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Code Review</h1>
        <p className="text-muted-foreground">Submit your code for automated analysis and suggestions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Input */}
        <div className="flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">File Path (optional)</label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g., myfile.py"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            <div className="mb-4 flex-1">
              <label className="block text-sm font-medium mb-2">Code to Review</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full h-96 px-3 py-2 border border-border rounded-md bg-background text-foreground font-mono text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={codeReviewLoading}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {codeReviewLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit for Review
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Review Results</h2>
          <div className="flex-1 overflow-auto space-y-4">
            {codeReviewResults.length > 0 ? (
              codeReviewResults.map((result, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4">
                  <div className="font-semibold mb-3 text-sm text-muted-foreground">{result.file}</div>

                  {result.issues.length > 0 ? (
                    <div className="space-y-3">
                      {result.issues.map((issue, issueIdx) => (
                        <div key={issueIdx} className={`border-l-4 p-3 rounded ${getSeverityColor(issue.severity)}`}>
                          <div className="flex gap-2 items-start mb-1">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-muted-foreground">
                                Line {issue.line} - {issue.severity.toUpperCase()}
                              </div>
                              <div className="text-sm font-medium mt-1">{issue.message}</div>
                            </div>
                          </div>
                          {issue.suggestion && (
                            <div className="mt-2 p-2 bg-background rounded text-xs">
                              <div className="text-muted-foreground font-semibold mb-1">Suggestion:</div>
                              <div className="font-mono">{issue.suggestion}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      No issues found
                    </div>
                  )}

                  {result.summary && (
                    <div className="mt-3 p-3 bg-muted rounded text-xs">
                      <div className="font-semibold mb-1">Summary</div>
                      <div>{result.summary}</div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="mb-2">No review results yet</div>
                <div className="text-xs">Submit code to the left to get started</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
