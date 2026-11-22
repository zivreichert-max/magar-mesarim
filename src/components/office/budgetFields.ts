// פניות תקציב — the fields of a request's analysis, in the format of the
// organization's own worksheet. Only the STRUCTURE lives here: the analysis
// itself is in a protected table and never in this (public) repo.
//
// A field's text is the admin's edit when there is one, otherwise the
// automatic analysis (written by the sync on the admin's PC).

import type { BudgetAnalysis } from '@/lib/supabase';

export const RECOMMENDATIONS = ['לאשר', 'לאשר בתנאי', 'לא לאשר', 'לפצל'] as const;

export interface BudgetField {
  key: string;
  label: string;        // the worksheet's column title
  rows?: number;        // textarea height when editing; none = a one-line field
  manual?: boolean;     // never filled automatically
}

/** Shown in a request's detail, most useful first. The recommendation and
 *  its reasoning have their own block above these. */
export const DETAIL_FIELDS: BudgetField[] = [
  { key: 'red_flags', label: 'דגלים אדומים', rows: 6 },
  { key: 'questions', label: 'שאלות מוצעות לדיון', rows: 6 },
  { key: 'essence', label: 'מהות הפנייה', rows: 6 },
  { key: 'program', label: 'משרד / תכנית מקבלת', rows: 2 },
  { key: 'amount', label: 'סכום הפנייה (אלש"ח)' },
  { key: 'original_budget', label: 'תקציב מקורי של התכנית (אלש"ח)' },
  { key: 'source', label: 'מקור התקציב', rows: 4 },
  { key: 'change_type', label: 'סוג השינוי וסעיף בחוק יסודות התקציב', rows: 2 },
  { key: 'normative', label: 'בסיס נורמטיבי (החלטות ממשלה)', rows: 3 },
  { key: 'why_not_base', label: 'למה לא תוקצב בבסיס / חד-פעמי או קבוע', rows: 4 },
  { key: 'coalition', label: 'כוללת רכיב קואליציוני?' },
  { key: 'coalition_amount', label: 'סכום הרכיב הקואליציוני (אלש"ח)' },
  { key: 'coalition_note', label: 'זיקה להסכם / הערה', rows: 3 },
  { key: 'legal_opinion', label: 'חוות דעת משפטית (הנחיה 1.1801)', rows: 2 },
  { key: 'legal_qa', label: 'שאלות הייעוץ המשפטי לוועדה ותשובות', rows: 5 },
  { key: 'request_date', label: 'תאריך הבקשה' },
  { key: 'hearing_date', label: 'מועד דיון בוועדה', manual: true },
  { key: 'notes', label: 'התייחסויות נוספות', rows: 3 },
];

/** The request's stable id: the record id inside its PDF address. The sync on
 *  the admin's PC derives the same id, so the two always meet. */
export function requestKey(reportUrl: string | null | undefined, number: string): string {
  const m = /\/FINANCE\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i.exec(reportUrl ?? '');
  return m ? m[1].toLowerCase() : `n:${number}`;
}

export const isEdited = (a: BudgetAnalysis | undefined, field: string) => !!a && field in a.edits;

export function fieldValue(a: BudgetAnalysis | undefined, field: string): string {
  if (!a) return '';
  return (field in a.edits ? a.edits[field] : a.auto[field]) ?? '';
}

/** "56000" → 56000; anything that is not a plain amount → null */
export function asAmount(text: string): number | null {
  const t = text.replace(/[,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** An amount field for display: thousands separators when it is a number, the text itself otherwise */
export function showAmount(text: string): string {
  const n = asAmount(text);
  return n === null ? text : n.toLocaleString('en-US');
}

/** The change as a share of the programme's original budget, when both are numbers */
export function changeShare(a: BudgetAnalysis | undefined): number | null {
  const amount = asAmount(fieldValue(a, 'amount'));
  const original = asAmount(fieldValue(a, 'original_budget'));
  return amount !== null && original !== null && original > 0 ? amount / original : null;
}

export const showShare = (share: number | null) => (share === null ? '' : `${(share * 100).toFixed(1)}%`);

// ── Export in the worksheet's own column order ───────────────────────────────
const SHEET_COLUMNS: [string, (r: SheetRow) => string][] = [
  ["מס' פנייה", r => (r.codes ? `${r.number} (בקשות אוצר ${r.codes.replace(/ · /g, ', ')})` : r.number)],
  ['משרד / תכנית מקבלת', r => fieldValue(r.analysis, 'program') || r.ministry],
  ['סכום הפנייה (אלש"ח)', r => fieldValue(r.analysis, 'amount')],
  ['מהות הפנייה', r => fieldValue(r.analysis, 'essence')],
  ['כוללת רכיב קואליציוני?', r => fieldValue(r.analysis, 'coalition')],
  ['סכום הרכיב הקואליציוני (אלש"ח)', r => fieldValue(r.analysis, 'coalition_amount')],
  ['זיקה להסכם / הערה', r => fieldValue(r.analysis, 'coalition_note')],
  ['חוות דעת משפטית (הנחיה 1.1801)', r => fieldValue(r.analysis, 'legal_opinion')],
  ['מקור התקציב', r => fieldValue(r.analysis, 'source')],
  ['סוג השינוי וסעיף בחוק יסודות התקציב', r => fieldValue(r.analysis, 'change_type')],
  ['בסיס נורמטיבי (החלטות ממשלה)', r => fieldValue(r.analysis, 'normative')],
  ['למה לא תוקצב בבסיס / חד-פעמי או קבוע', r => fieldValue(r.analysis, 'why_not_base')],
  ['תקציב מקורי של התוכנית (אלש"ח)', r => fieldValue(r.analysis, 'original_budget')],
  ['השינוי כ-% מהמקורי', r => showShare(changeShare(r.analysis))],
  ['שאלות הייעוץ המשפטי לוועדה ותשובות', r => fieldValue(r.analysis, 'legal_qa')],
  ['תאריך הבקשה', r => fieldValue(r.analysis, 'request_date')],
  ['מועד דיון בוועדה', r => fieldValue(r.analysis, 'hearing_date')],
  ['דגלים אדומים', r => fieldValue(r.analysis, 'red_flags')],
  ['התייחסויות נוספות', r => fieldValue(r.analysis, 'notes')],
  ['המלצה ליו"ר', r => fieldValue(r.analysis, 'recommendation')],
  ['נימוק ההמלצה', r => fieldValue(r.analysis, 'rec_reason')],
  ['שאלות מוצעות לדיון', r => fieldValue(r.analysis, 'questions')],
];

export interface SheetRow {
  number: string;
  codes: string;
  ministry: string;
  analysis: BudgetAnalysis | undefined;
}

/** A CSV that Excel opens as the worksheet (UTF-8 with BOM, one request per row) */
export function toSheetCsv(rows: SheetRow[]): string {
  // A leading = + - @ would be read by Excel as a formula
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const lines = [SHEET_COLUMNS.map(([title]) => cell(title)).join(',')];
  for (const r of rows) lines.push(SHEET_COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return '﻿' + lines.join('\r\n');
}
