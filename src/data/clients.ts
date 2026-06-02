export const CLIENTS = [
  { id: 'democrats',  name: 'דמוקרטים',      color: '#dc2626', password: '6121' },
  { id: 'beyahad',    name: 'ביחד',            color: '#16a34a', password: '8384' },
  { id: 'yisrael-b',  name: 'ישראל ביתנו',    color: '#1d4ed8', password: '0710' },
  { id: 'yashar',     name: 'ישר',             color: '#6b7280', password: '2026' },
] as const;
export type ClientId = typeof CLIENTS[number]['id'];
export type Client   = typeof CLIENTS[number];
