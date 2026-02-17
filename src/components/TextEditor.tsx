import { useEffect, useRef } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

/**
 * HTML textarea overlay for inline text editing on double-click.
 * Positioned via worldToScreen coordinates from the caller.
 */
export function TextEditor({
  x,
  y,
  width,
  height,
  text,
  fontSize,
  onSubmit,
  onCancel,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus and select all text on mount
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleBlur = () => {
    const value = textareaRef.current?.value ?? text;
    onSubmit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    // Enter without shift submits
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const value = textareaRef.current?.value ?? text;
      onSubmit(value);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={text}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width,
        height,
        fontSize,
        padding: 8,
        border: '2px solid #4ECDC4',
        borderRadius: 4,
        background: 'rgba(255, 255, 255, 0.95)',
        resize: 'none',
        fontFamily: 'inherit',
        lineHeight: 1.4,
        outline: 'none',
        zIndex: 2000,
        boxSizing: 'border-box',
      }}
    />
  );
}
