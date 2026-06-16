import { useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAstStore } from '../sync';
import Console from '../console/Console';
import type { LogEntry } from './Types';

function CodeEditor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const source    = useAstStore((s) => s.source);
  const lastOrigin = useAstStore((s) => s.lastOrigin);
  const setSource = useAstStore((s) => s.setSource);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Listen for messages from the sandbox iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        setLogs(prev => [...prev, {
          level: event.data.level,
          text: event.data.args.join(' '),
        }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  function handleEditorDidMount(editor: editor.IStandaloneCodeEditor) {
    editorRef.current = editor;
  }

  function handleEditorChange(value?: string) {
    if (!value) return;
    setSource(value, "editor");
  }

  function handleEditorValidation(markers: any) {
    markers.forEach((marker: any) =>
      console.log(`ERROR [Line ${marker.startLineNumber}] : ${marker.message}`)
    );
  }

  const runCode = useCallback(() => {
    const code = editorRef.current?.getValue();
    if (!code) return;

    // setLogs([]); // clear previous output
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', code }, '*');
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Toolbar */}
      <div style={{ padding: '6px 10px', background: '#2d2d2d', borderBottom: '1px solid #3e3e3e' }}>
        <button
          onClick={runCode}
          style={{
            background: '#0e639c',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '4px 14px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ▶ Run
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="typescript"
          value={lastOrigin === "editor" ? undefined : source}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          onValidate={handleEditorValidation}
        />
      </div>

      {/* Console panel */}
      <div style={{ height: '30%', borderTop: '1px solid #3e3e3e' }}>
        <Console logs={logs} onClear={() => setLogs([])} />
      </div>

      {/* Sandboxed iframe — hidden, owned here so it shares the message listener */}
      <iframe
        ref={iframeRef}
        src="/sandbox.html"
        sandbox="allow-scripts"
        style={{ display: 'none' }}
        title="code-sandbox"
      />
    </div>
  );
}

export default CodeEditor;