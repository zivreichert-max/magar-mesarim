export interface Paper {
  id: number;
  title: string;
  tag: string;
  summary: string;
  sections: {
    label: string;
    type: 'text' | 'bullets';
    content: string;
    items?: string[];
  }[];
  bottomLine: string;
  // Source PDF filename in OneDrive…/ניירות עמדה שבועיים (top level). Links the
  // paper to its file so check-papers.py can flag new/removed PDFs. Not rendered.
  sourceFile?: string;
}

// Source of truth for position papers shown on the site. Mirrors the current
// contents of OneDrive…/דף מסרים/ניירות עמדה שבועיים (top level only — papers
// moved into the "ישן" subfolder are dropped here and no longer appear).
// IDs are stable (Supabase paper_shares keys on paper_id) — do not renumber.
// Removing a PDF from the folder does NOT update this file automatically —
// run check-papers.py to see drift, then edit here. Next id to assign: 11.
export const PAPERS: Paper[] = [];
