import type { CSSProperties } from 'react';

export const TOOLBAR_BUTTON_TOKENS = {
  minHeight: 28,
  minWidth: 28,
  paddingX: 10,
  iconButtonWidth: 28,
  borderRadius: 3,
  fontSize: 12,
} as const;

export const TOOLBAR_BUTTON_BASE_STYLE: CSSProperties = {
  minHeight: `${TOOLBAR_BUTTON_TOKENS.minHeight}px`,
  minWidth: `${TOOLBAR_BUTTON_TOKENS.minWidth}px`,
  padding: `0 ${TOOLBAR_BUTTON_TOKENS.paddingX}px`,
  border: 'none',
  borderRadius: `${TOOLBAR_BUTTON_TOKENS.borderRadius}px`,
  cursor: 'pointer',
  fontSize: `${TOOLBAR_BUTTON_TOKENS.fontSize}px`,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  flexShrink: 0,
};

export const TOOLBAR_ICON_BUTTON_STYLE: CSSProperties = {
  ...TOOLBAR_BUTTON_BASE_STYLE,
  width: `${TOOLBAR_BUTTON_TOKENS.iconButtonWidth}px`,
  padding: '0',
};