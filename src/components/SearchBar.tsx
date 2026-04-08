/**
 * Search Bar Component
 * Provides search and filter functionality for commits
 */

import React, { useRef, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';

export default function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchFilter,
    setSearchFilter,
    commits,
    filteredCommits,
  } = useCommitStoryStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, setSearchQuery]);

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'message', label: 'Message' },
    { id: 'author', label: 'Author' },
    { id: 'hash', label: 'Hash' },
  ] as const;

  return (
    <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commits... (Ctrl+K)"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Dropdown */}
      <div className="relative">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value as any)}
            className="py-2 pl-2 pr-8 text-sm rounded-md border border-border bg-background focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
          >
            {filterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      {searchQuery && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredCommits.length} of {commits.length}
        </span>
      )}
    </div>
  );
}
