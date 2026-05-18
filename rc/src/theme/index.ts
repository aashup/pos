export type Theme = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  border: string;
  borderLight: string;
  statusBarStyle: 'dark-content' | 'light-content';
  scrim: string;
};

export const lightTheme: Theme = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  primary: '#0ea5e9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  statusBarStyle: 'dark-content',
  scrim: 'rgba(15,23,42,0.45)',
};

export const darkTheme: Theme = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#0ea5e9',
  border: '#334155',
  borderLight: '#1e293b',
  statusBarStyle: 'light-content',
  scrim: 'rgba(0,0,0,0.6)',
};
