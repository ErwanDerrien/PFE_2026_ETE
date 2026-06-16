export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}