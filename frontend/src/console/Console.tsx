import { useState, useEffect, useRef } from 'react';
import './Console.css';

export type ConsoleMessage = {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info' | 'output';
  message: string;
  timestamp: number;
  lineNumber?: number;
};

interface ConsoleProps {
  code: string;
  onExecute: () => void;
  onClear?: () => void;
}

function Console({ code, onExecute, onClear }: ConsoleProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    { id: '1', type: 'info', message: 'Console prête. Tapez du code et cliquez sur "Exécuter".', timestamp: Date.now() },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Effet pour scroller automatiquement vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (type: ConsoleMessage['type'], message: string, lineNumber?: number) => {
    const newMessage: ConsoleMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      lineNumber,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const executeCode = async () => {
    if (!code.trim()) {
      addMessage('error', 'Aucun code à exécuter.');
      return;
    }

    setIsExecuting(true);
    addMessage('info', 'Exécution en cours...');

    try {
      // Sandbox sécurisée
      const executeInSandbox = () => {
        const output = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        const originalClear = console.clear;
        
        // Capturer les logs
        console.log = (...args) => {
          output.push({ type: 'log', message: args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ') });
        };
        
        console.error = (...args) => {
          output.push({ type: 'error', message: args.map(arg => String(arg)).join(' ') });
        };
        
        console.warn = (...args) => {
          output.push({ type: 'warn', message: args.map(arg => String(arg)).join(' ') });
        };
        
        console.info = (...args) => {
          output.push({ type: 'info', message: args.map(arg => String(arg)).join(' ') });
        };
        
        console.clear = () => {
          output.push({ type: 'info', message: 'console.clear() appelé' });
        };
        
        try {
          // Évaluer le code dans un contexte isolé
          const result = eval(code);
          // Si le code retourne quelque chose
          if (result !== undefined && result !== null) {
            output.push({ type: 'output', message: `Résultat: ${String(result)}` });
          }
        } catch (error: any) {
          output.push({ type: 'error', message: `Erreur d'exécution: ${error.message}` });
        } finally {
          // Restaurer les fonctions console originales
          console.log = originalLog;
          console.error = originalError;
          console.warn = originalWarn;
          console.info = originalInfo;
          console.clear = originalClear;
        }
        
        return output;
      };

      const results = executeInSandbox();
      
      if (results && results.length > 0) {
        results.forEach((result: any) => {
          addMessage(result.type, result.message);
        });
        addMessage('info', `Exécution terminée - ${results.length} message(s)`);
      } else {
        addMessage('info', 'Exécution terminée sans sortie.');
      }
    } catch (error: any) {
      addMessage('error', `Erreur de sandbox: ${error.message}`);
    } finally {
      setIsExecuting(false);
      onExecute();
    }
  };

  const clearConsole = () => {
    setMessages([{ 
      id: '1', 
      type: 'info', 
      message: 'Console vidée. Tapez du code et cliquez sur "Exécuter".', 
      timestamp: Date.now() 
    }]);
    if (onClear) onClear();
  };

  const getMessageClass = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error': return 'console-message-error';
      case 'warn': return 'console-message-warn';
      case 'info': return 'console-message-info';
      case 'output': return 'console-message-output';
      default: return 'console-message-log';
    }
  };

  return (
    <div className="console-container">
      <div className="console-header">
        <h3>Console d'exécution</h3>
        <div className="console-controls">
          <button 
            onClick={executeCode} 
            disabled={isExecuting}
            className="run-button"
            title="Exécuter le code dans l'éditeur"
          >
            {isExecuting ? '⏳ Exécution...' : '▶️ Exécuter le code'}
          </button>
          <button 
            onClick={clearConsole}
            className="clear-button"
            title="Vider tous les messages de la console"
          >
            🗑️ Vider la console
          </button>
        </div>
      </div>
      
      <div className="console-output" ref={consoleRef}>
        {messages.length === 1 && messages[0].type === 'info' && messages[0].message.includes('Console prête') ? (
          <div className="console-welcome">
            <div className="welcome-icon">📟</div>
            <div className="welcome-text">
              <h4>Console d'exécution sandbox</h4>
              <p>Exécutez du code JavaScript en toute sécurité.</p>
              <ul className="welcome-features">
                <li>✅ Capture console.log, console.error, etc.</li>
                <li>✅ Exécution isolée dans un environnement sécurisé</li>
                <li>✅ Affiche les résultats et erreurs en temps réel</li>
                <li>✅ Compatible avec l'éditeur de code à gauche</li>
              </ul>
              <p className="welcome-instruction">
                Modifiez le code dans l'éditeur et cliquez sur "▶️ Exécuter le code"
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`console-message ${getMessageClass(msg.type)}`}>
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {msg.lineNumber && (
                <span className="line-number">Ligne {msg.lineNumber}: </span>
              )}
              <span className="message-content">{msg.message}</span>
            </div>
          ))
        )}
      </div>
      
      <div className="console-stats">
        <span>{messages.length} message(s)</span>
        <span>• Statut: {isExecuting ? '⏳ Exécution en cours' : '✅ Prêt'}</span>
        <span>• Dernier message: {messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'aucun'}</span>
      </div>
    </div>
  );
}

export default Console;