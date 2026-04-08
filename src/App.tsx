import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import Dashboard from '@/pages/Dashboard';
import EnvironmentHealth from '@/pages/EnvironmentHealth';
import CodeReview from '@/pages/CodeReview';
import CommitStory from '@/pages/CommitStory';
import Navigation from '@/components/Navigation';
import ErrorAlert from '@/components/ErrorAlert';

type Page = 'dashboard' | 'health' | 'review' | 'commits';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { error, clearError } = useAppStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'health':
        return <EnvironmentHealth />;
      case 'review':
        return <CodeReview />;
      case 'commits':
        return <CommitStory />;
      case 'dashboard':
      default:
        return <Dashboard onNavigate={(page) => setCurrentPage(page as Page)} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Navigation currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)} />
      <main className="flex-1 overflow-auto">
        {error && <ErrorAlert message={error} onDismiss={clearError} />}
        {renderPage()}
      </main>
    </div>
  );
}
