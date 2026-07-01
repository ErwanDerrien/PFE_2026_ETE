import { useRef, useEffect } from 'react';

export type LogEntry = {
  level: 'log' | 'error' | 'warn' | 'info';
  text: string;
  timestamp: number;
};

interface OutputConsoleProps {
  logs: LogEntry[];
  style?: React.CSSProperties;
}

function OutputConsole({ logs, style }: OutputConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const colors: Record<string, string> = {
    error: '#f48771',
    warn: '#dcdcaa',
    info: '#4ec9b0',
    log: '#cccccc',
  };

  const defaultStyle: React.CSSProperties = {
    height: '30%',
    borderTop: '1px solid #3e3e3e',
    background: '#1e1e1e',
    overflowY: 'auto',
    padding: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#cccccc',
  };

  return (
    <div ref={consoleRef} style={{ ...defaultStyle, ...style }}>
      {logs.length === 0 ? (
        <div style={{ color: '#666', fontSize: '11px' }}>Output will appear here...</div>
      ) : (
        logs.map((log, i) => {
          const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={i}
              style={{
                color: colors[log.level] || '#cccccc',
                marginBottom: '4px',
                display: 'flex',
                gap: '8px',
              }}
            >
              <span style={{ color: '#666', minWidth: '60px' }}>
                [{time}]
              </span>
              <span>{log.text}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default OutputConsole;
