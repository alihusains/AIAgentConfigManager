import { useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

/**
 * A plain-text editor with a synced line-number gutter — no syntax
 * highlighting, no external editor dependency. Good enough for editing a
 * small JSON/YAML/TOML config file by hand; the gutter scrolls in lockstep
 * with the textarea via a shared scroll handler.
 */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = value.length === 0 ? 1 : value.split('\n').length;

  const syncScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="code-editor">
      <div className="code-editor-gutter" ref={gutterRef} aria-hidden>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="code-editor-line-number">
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="code-editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
      />
    </div>
  );
}
