import { useRef, useEffect, useState } from 'react';

export type LogEntry = {
  level: 'log' | 'error' | 'warn' | 'info';
  text: string;
  timestamp: number;
};

interface OutputConsoleProps {
  logs: LogEntry[];
  style?: React.CSSProperties;
  isWaitingForInput?: boolean;
  inputPrompt?: string;
  onInputSubmit?: (value: string) => void;
}

function OutputConsole({ logs, style, isWaitingForInput = false, inputPrompt = '', onInputSubmit }: OutputConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Focus input when it appears
  useEffect(() => {
    if (isWaitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingForInput]);

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

  const handleSubmit = () => {
    onInputSubmit?.(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const defaultStyle: React.CSSProperties = {
    height: '100%',
    borderTop: '1px solid #3e3e3e',
    background: '#1e1e1e',
    overflowY: 'auto',
    padding: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#cccccc',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ ...defaultStyle, ...style }}>
      {isWaitingForInput && (
        <div style={{
          background: '#f48771',
          padding: '8px',
          marginBottom: '8px',
          borderRadius: '4px',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#000', fontSize: '12px' }}>{inputPrompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: '4px 6px',
              background: '#fff',
              border: 'none',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: '12px',
              borderRadius: '3px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: '4px 10px',
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            OK
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
    </div>
  );
}

export default OutputConsole;
