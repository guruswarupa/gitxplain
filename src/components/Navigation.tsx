import React from 'react';
import { Activity, Home, Code2, GitBranch } from 'lucide-react';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: any) => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const navItems = [
    { id: 'story', label: 'Commit Story Desktop', icon: GitBranch },
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'health', label: 'Environment Health', icon: Activity },
    { id: 'review', label: 'Code Review', icon: Code2 },
    { id: 'commits', label: 'Old Commit View', icon: GitBranch },
  ];

  return (
    <nav className="border-b border-border bg-card">
      <div className="px-6 py-4">
        <div className="flex items-center gap-8">
          <div className="font-bold text-lg text-primary">DevInsight</div>
          <div className="flex gap-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
