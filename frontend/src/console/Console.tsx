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

// Type pour les promesses d'input en attente
type PendingInput = {
  resolve: (value: string) => void;
  question: string;
};

function Console({ code, onExecute, onClear }: ConsoleProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    { id: '1', type: 'info', message: 'Console prête. Tapez du code et cliquez sur "Exécuter" ou tapez directement dans le champ ci-dessous.', timestamp: Date.now() },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [inputMode, setInputMode] = useState(false);
  const [inputQuestion, setInputQuestion] = useState("");
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Fonction pour gérer les demandes d'input du code utilisateur
  const handleInputRequest = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      // Afficher la question
      addMessage('info', `${question}`);
      
      // Activer le mode input et mettre en attente
      setInputMode(true);
      setInputQuestion(question);
      setPendingInput({ resolve, question });
      
      // Focus sur l'input
      setTimeout(() => {
        const inputEl = document.querySelector('.console-input-modal') as HTMLInputElement;
        if (inputEl) inputEl.focus();
      }, 100);
    });
  };

  // Soumettre la réponse de l'utilisateur
  const submitInput = () => {
    if (pendingInput) {
      const value = userInput;
      addMessage('input', `> ${value}`);
      pendingInput.resolve(value);
      setPendingInput(null);
      setInputMode(false);
      setInputQuestion("");
      setUserInput("");
    }
  };

  // Annuler l'input
  const cancelInput = () => {
    if (pendingInput) {
      pendingInput.resolve("");
      setPendingInput(null);
      setInputMode(false);
      setInputQuestion("");
      setUserInput("");
      addMessage('warn', 'Input annulé');
    }
  };

  // Fonction pour transformer le code en version async avec support de input()
  const transformToAsyncCode = (code: string): string => {
    // Remplacer les appels à input() par une version await
    // Cette regex trouve les appels input("question")
    const inputRegex = /input\s*\(\s*(['"`])(.*?)\1\s*\)/g;
    
    // Transformer le code: input("question") devient await input("question")
    let asyncCode = code.replace(inputRegex, 'await input($1$2$1)');
    
    // Ajouter "use strict" et rendre le tout async
    asyncCode = `'use strict';
${asyncCode}`;
    
    return asyncCode;
  };

  const executeCode = async () => {
    if (!code.trim()) {
      addMessage('error', 'Aucun code à exécuter.');
      return;
    }

    setIsExecuting(true);
    addMessage('info', 'Exécution en cours...');

    try {
      // Transformer le code en version async
      const asyncCode = transformToAsyncCode(code);
      
      // Créer une fonction async qui sera exécutée
      const asyncFunction = new Function('input', 'console', `
        return (async () => {
          ${asyncCode}
        })();
      `);
      
      // Créer notre propre console qui capture les sorties
      const capturedLogs: Array<{type: string, message: string}> = [];
      
      const customConsole = {
        log: (...args: any[]) => {
          const msg = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');
          capturedLogs.push({ type: 'log', message: msg });
        },
        error: (...args: any[]) => {
          capturedLogs.push({ type: 'error', message: args.map(String).join(' ') });
        },
        warn: (...args: any[]) => {
          capturedLogs.push({ type: 'warn', message: args.map(String).join(' ') });
        },
        info: (...args: any[]) => {
          capturedLogs.push({ type: 'info', message: args.map(String).join(' ') });
        },
        clear: () => {
          capturedLogs.push({ type: 'info', message: 'console.clear() appelé' });
        }
      };
      
      // Créer la fonction input qui utilise notre handleInputRequest
      const customInput = async (question: string): Promise<string> => {
        return new Promise((resolve) => {
          addMessage('info', `${question}`);
          setInputMode(true);
          setInputQuestion(question);
          setPendingInput({ resolve, question });
          
          // Focus sur l'input
          setTimeout(() => {
            const inputEl = document.querySelector('.console-input-modal') as HTMLInputElement;
            if (inputEl) inputEl.focus();
          }, 100);
        });
      };
      
      // Exécuter la fonction async
      await asyncFunction(customInput, customConsole);
      
      // Afficher tous les messages capturés
      capturedLogs.forEach((log) => {
        addMessage(log.type as any, log.message);
      });
      
      addMessage('info', 'Exécution terminée.');
      
    } catch (error: any) {
      addMessage('error', `Erreur: ${error.message}`);
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
      case 'input': return 'console-message-input';
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
      
      {/* Mode input modal - affiché quand le code demande une entrée */}
      {inputMode && (
        <div className="console-input-modal">
          <div className="input-modal-content">
            <div className="input-modal-question">
              {inputQuestion && <span>{inputQuestion}</span>}
            </div>
            <div className="input-modal-field">
              <span className="input-prompt">&gt;</span>
              <input
                type="text"
                className="console-input-modal"
                placeholder="Tapez votre réponse..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitInput()}
                autoFocus
              />
              <button 
                className="input-submit"
                onClick={submitInput}
              >
                ✓
              </button>
              <button 
                className="input-cancel"
                onClick={cancelInput}
              >
                ✕
              </button>
            </div>
            <p className="input-modal-hint">Appuyez sur Entrée pour soumettre</p>
          </div>
        </div>
      )}
      
      <div className="console-stats">
        <span>{messages.length} message(s)</span>
        <span>• Statut: {isExecuting ? '⏳ Exécution en cours' : '✅ Prêt'}</span>
        <span>• Dernier message: {messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'aucun'}</span>
      </div>
    </div>
  );
}

export default Console;