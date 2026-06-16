import type { LogEntry } from '../editor/Types';
import { useEffect, useRef } from 'react';

const LEVEL_COLORS: Record<string, string> = {
  log:   '#d4d4d4',
  info:  '#9cdcfe',
  warn:  '#cca700',
  error: '#f48771',
};

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

function Console({ logs, onClear }: ConsoleProps) {
 const scrollRef = useRef<HTMLDivElement | null>(null);

   // Scroll to bottom whenever logs change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1e1e1e',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px',
        background: '#2d2d2d',
        borderBottom: '1px solid #3e3e3e',
      }}>
        <span style={{ color: '#858585', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Console
        </span>
        <button
          onClick={onClear}
          title="Clear console"
          style={{
            background: 'none',
            border: 'none',
            color: '#858585',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0px' }}>
        {logs.length === 0 ? (
          <div style={{ color: '#555', padding: '8px 16px', fontStyle: 'italic', textAlign: 'left' }}>
            No output yet. Press Run to execute your code.
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                color: LEVEL_COLORS[log.level] ?? '#d4d4d4',
                padding: '2px 16px',
                borderBottom: '1px solid #2a2a2a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                textAlign: 'left'
              }}
            >
              <span style={{ color: '#555', marginRight: 8, userSelect: 'none' }}>
                {log.level === 'error' ? '✖' : log.level === 'warn' ? '⚠' : '›'}
              </span>
              {log.text}
            </div>
          ))
        )}
      </div>

      {/* Hidden sandbox iframe */}
    </div>
  );
}

export default Console;