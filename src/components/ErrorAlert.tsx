import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss: () => void;
}

export default function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="mx-6 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-destructive">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-destructive hover:text-destructive/80 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
