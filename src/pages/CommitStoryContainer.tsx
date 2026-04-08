/**
 * Commit Story Main Container
 * Orchestrates the different views based on current tab
 */

import React from 'react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import CommitStoryLayout from '../components/CommitStoryLayout';
import ChangesView from './ChangesView';
import HistoryView from './HistoryView';
import StoriesView from './StoriesView';
import InsightsView from './InsightsView';
import SettingsView from './SettingsView';

export default function CommitStoryContainer() {
  const { currentTab } = useCommitStoryStore();

  const renderTabContent = () => {
    switch (currentTab) {
      case 'changes':
        return <ChangesView />;
      case 'history':
        return <HistoryView />;
      case 'stories':
        return <StoriesView />;
      case 'insights':
        return <InsightsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HistoryView />;
    }
  };

  return (
    <CommitStoryLayout>
      {renderTabContent()}
    </CommitStoryLayout>
  );
}
