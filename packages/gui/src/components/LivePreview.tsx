/**
 * LivePreview Component
 *
 * IC Signature Theme: Real-time display of data with instant updates
 * Shows live results from controls with professional mockup styling.
 * No animations — pure speed and efficiency.
 *
 * Design: Clean, professional, context-aware presentation.
 * No breaking changes to existing components.
 */

import React, { ReactNode, useEffect, useState } from 'react';

export type PreviewFormat = 'json' | 'html' | 'text' | 'custom';

export interface LivePreviewProps {
  /** Data to display */
  data: unknown;
  /** Template or renderer function */
  template?: (data: unknown) => ReactNode;
  /** Format hint for display (json, html, text, custom) */
  format?: PreviewFormat;
  /** Optional title */
  title?: string;
  /** Whether to show as code block */
  showCode?: boolean;
  /** Copy-to-clipboard support */
  copyable?: boolean;
  /** Callback when copy succeeds */
  onCopy?: () => void;
  /** Optional className */
  className?: string;
}

export const LivePreview = React.memo(function LivePreview({
  data,
  template,
  format = 'text',
  title,
  showCode = false,
  copyable = true,
  onCopy,
  className = '',
}: LivePreviewProps) {
  const [copied, setCopied] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  /**
   * Format data for display
   */
  const formatContent = (): string => {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    if (format === 'html') {
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
    return typeof data === 'string' ? data : JSON.stringify(data);
  };

  /**
   * Copy to clipboard
   */
  const handleCopy = async () => {
    try {
      const content = formatContent();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const content = formatContent();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header with copy button */}
      {(title || copyable) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h4 className="text-sm font-medium text-primary">
              {title}
            </h4>
          )}
          {copyable && (
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1.5 rounded-md transition-all duration-150 ${
                copied
                  ? 'bg-success/20 text-success'
                  : 'bg-secondary text-primary hover:bg-border'
              }`}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {template ? (
          // Custom template
          <div className="text-sm text-primary">
            {template(data)}
          </div>
        ) : showCode ? (
          // Code block format
          <pre className="bg-secondary/50 text-primary text-xs p-4 rounded-lg overflow-auto max-h-[400px] font-mono border border-border">
            <code>{content}</code>
          </pre>
        ) : (
          // Plain text format
          <div className="text-sm text-primary whitespace-pre-wrap break-words p-4 bg-secondary/30 rounded-lg border border-border">
            {content}
          </div>
        )}
      </div>

      {/* Status indicator */}
      {copied && (
        <div className="text-xs text-success flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-success" />
          Preview copied to clipboard
        </div>
      )}
    </div>
  );
});

LivePreview.displayName = 'LivePreview';
