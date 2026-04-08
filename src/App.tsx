import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useCommitStoryStore } from '@/store/commitStoryStore';
import Dashboard from '@/pages/Dashboard';
import EnvironmentHealth from '@/pages/EnvironmentHealth';
import CodeReview from '@/pages/CodeReview';
import CommitStory from '@/pages/CommitStory';
import CommitStoryContainer from '@/pages/CommitStoryContainer';
import Navigation from '@/components/Navigation';
import ErrorAlert from '@/components/ErrorAlert';

type Page = 'dashboard' | 'health' | 'review' | 'commits' | 'story';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('story');
  const { error: appError, clearError: clearAppError } = useAppStore();
  const { error: storyError, clearError: clearStoryError } = useCommitStoryStore();

  const error = appError || storyError;
  const clearError = () => {
    clearAppError();
    clearStoryError();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'story':
        return <CommitStoryContainer />;
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
      {currentPage !== 'story' && (
        <Navigation currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)} />
      )}
      <main className={`flex-1 min-h-0 ${currentPage === 'story' ? '' : 'overflow-auto'}`}>
        {error && <ErrorAlert message={error} onDismiss={clearError} />}
        {renderPage()}
      </main>
    </div>
  );
}
