export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
  timestamp: number; // millisecond timestamp
}