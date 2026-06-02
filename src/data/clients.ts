export const CLIENTS = [
  { id: 'naama', name: 'נעמה לזימי', color: '#7c3aed', password: '6121' },
  { id: 'liran',  name: 'לירן אבישר',  color: '#d97706', password: '8384' },
] as const;
export type ClientId = typeof CLIENTS[number]['id'];
export type Client   = typeof CLIENTS[number];
