import { useState, useCallback } from 'react';

/**
 * Copies the current board URL to clipboard.
 * URLs are already UUID-based (/board/:id) so they're inherently shareable.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        padding: '8px 16px',
        background: copied ? '#27ae60' : '#fff',
        color: copied ? '#fff' : '#333',
        border: 'none',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 1000,
        transition: 'all 0.2s',
      }}
    >
      {copied ? 'Link Copied!' : 'Share Board'}
    </button>
  );
}
