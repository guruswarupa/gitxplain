/**
 * Commit Story Main Layout
 * GitHub Desktop-inspired layout with sidebar and tabbed interface
 */

import React from 'react';
import { FileText, History, BookOpen, BarChart3, Settings } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';
import ProjectSidebar from './ProjectSidebar';

interface CommitStoryLayoutProps {
  children?: React.ReactNode;
}

export default function CommitStoryLayout({ children }: CommitStoryLayoutProps) {
  const { currentTab, setCurrentTab, currentProject } = useCommitStoryStore();

  const tabs = [
    { id: 'changes', label: 'Changes', icon: FileText },
    { id: 'history', label: 'History', icon: History },
    { id: 'stories', label: 'Stories', icon: BookOpen },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="flex h-full bg-background">
      {/* Project Sidebar */}
      <ProjectSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-border bg-card">
          <div className="flex items-center px-6 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              // Settings tab is always enabled
              const isDisabled = !currentProject && tab.id !== 'settings';
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                  
                  {/* Badge for Stories */}
                  {tab.id === 'stories' && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {!currentProject && currentTab !== 'settings' ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Repository Selected</h3>
                <p className="text-sm">
                  Select a repository from the sidebar or add a new one to get started
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
