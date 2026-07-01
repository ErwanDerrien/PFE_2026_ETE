import { useRef, useEffect, useState, useCallback } from 'react';

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
  onInputCancel?: () => void;
  isRunning?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  onClear?: () => void;
}

function OutputConsole({ logs, style, isWaitingForInput = false, inputPrompt = '', onInputSubmit, onInputCancel, isRunning = false, onRun, onStop, onClear }: OutputConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(12);

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
  }, [logs, isWaitingForInput]);

  const colors: Record<string, string> = darkMode ? {
    error: '#f48771',
    warn: '#dcdcaa',
    info: '#4ec9b0',
    log: '#cccccc',
  } : {
    error: '#c0392b',
    warn: '#b07d00',
    info: '#0e6b5e',
    log: '#1a1a1a',
  };

  const bg = darkMode ? '#1e1e1e' : '#f5f5f5';
  const textColor = darkMode ? '#cccccc' : '#1a1a1a';
  const borderColor = darkMode ? '#3e3e3e' : '#d0d0d0';
  const toolbarBg = darkMode ? '#252526' : '#e8e8e8';

  const handleSubmit = () => {
    onInputSubmit?.(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      setInputValue('');
      onInputCancel?.();
    }
  };

  const downloadLogs = useCallback(() => {
    const text = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false });
      return `[${time}] [${log.level.toUpperCase()}] ${log.text}`;
    }).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'console-output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  const btnStyle = (color: string): React.CSSProperties => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    flexShrink: 0,
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: bg, ...style }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: toolbarBg, borderBottom: `1px solid ${borderColor}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {isRunning ? (
          <button onClick={onStop} style={btnStyle('#f48771')}>⏹ Stop</button>
        ) : (
          <button onClick={onRun} style={btnStyle('#0e639c')}>▶ Run</button>
        )}
        <button onClick={onClear} style={btnStyle('#555')}>✖ Clear</button>

        <div style={{ width: '1px', height: '18px', background: borderColor, margin: '0 2px' }} />

        <button
          onClick={() => setDarkMode(d => !d)}
          title="Toggle theme"
          style={{ ...btnStyle('#444'), background: 'transparent', color: darkMode ? '#ccc' : '#555', border: `1px solid ${borderColor}` }}
        >
          {darkMode ? '🌙' : '☀️'}
        </button>

        <label style={{ color: textColor, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ opacity: 0.6 }}>A</span>
          <input
            type="range" min={10} max={20} value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ cursor: 'pointer', width: '60px' }}
          />
        </label>

        <button
          onClick={downloadLogs}
          disabled={logs.length === 0}
          title="Download as .txt"
          style={{ ...btnStyle('#666'), opacity: logs.length === 0 ? 0.4 : 1 }}
        >
          ⬇ .txt
        </button>
      </div>

      {/* Logs */}
      <div ref={consoleRef} style={{ flex: 1, overflowY: 'auto', padding: '8px', fontFamily: 'monospace', fontSize: `${fontSize}px`, color: textColor }}>
        {logs.length === 0 ? (
          <div style={{ color: darkMode ? '#666' : '#aaa', fontSize: '11px' }}>Output will appear here...</div>
        ) : (
          logs.map((log, i) => {
            const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={i} style={{ color: colors[log.level] || textColor, marginBottom: '4px', display: 'flex', gap: '8px' }}>
                <span style={{ color: darkMode ? '#666' : '#aaa', minWidth: '60px' }}>[{time}]</span>
                <span>{log.text}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Input bar — bottom */}
      {isWaitingForInput && (
        <div style={{ background: '#2d2d2d', border: '1px solid #f48771', borderTop: '1px solid #f48771', padding: '6px 8px', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#f48771', fontSize: '12px', whiteSpace: 'nowrap' }}>{inputPrompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, padding: '4px 6px', background: '#1e1e1e', border: '1px solid #555', color: '#cccccc', fontFamily: 'monospace', fontSize: '12px', borderRadius: '3px', outline: 'none' }}
          />
          <button onClick={handleSubmit} style={{ padding: '4px 10px', background: '#0e639c', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            OK
          </button>
          <button onClick={() => { setInputValue(''); onInputCancel?.(); }} title="Annuler (Ctrl+C)" style={{ padding: '4px 8px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default OutputConsole;
