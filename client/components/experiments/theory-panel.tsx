'use client';

import 'katex/dist/katex.min.css';

import katex from 'katex';
import { BookOpen, Lock } from 'lucide-react';
import * as React from 'react';

interface TheoryPanelProps {
  theory: string | null;
  /**
   * The formula itself lives in the course block and is available from the
   * start; what waits for the end is the synthesis - why it works, and the
   * limits of the result.
   */
  unlocked: boolean;
}

/**
 * Renders the theory block, revealed only once the TP is validated.
 *
 * Inline `$...$` and display `$$...$$` are rendered with KaTeX; everything else
 * is escaped and printed as-is, so a formula in the seed data never becomes an
 * HTML injection vector.
 */
export function TheoryPanel({ theory, unlocked }: TheoryPanelProps) {
  const html = React.useMemo(() => {
    if (!theory || !unlocked) return '';
    return theory
      .split('\n\n')
      .map((paragraph) => `<p>${renderInline(paragraph)}</p>`)
      .join('');
  }, [theory, unlocked]);

  if (!unlocked) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-ink-50 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <div>
          <p className="text-sm font-medium text-ink-700">Synthèse à débloquer</p>
          <p className="mt-1 text-sm text-ink-500">
            La formule et l’exemple résolu sont dans « Rappel de cours ». Ce bloc-ci reprend le
            raisonnement complet et ses limites, une fois le TP validé.
          </p>
        </div>
      </div>
    );
  }

  if (!theory) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-ink-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent-600">
        <BookOpen className="h-3.5 w-3.5" />
        Synthèse
      </p>
      <div
        className="space-y-3 text-sm leading-relaxed text-ink-700 [&_p]:whitespace-pre-line"
        // Content comes from our own seed data and every non-math segment is
        // HTML-escaped by `escapeHtml` below.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(paragraph: string): string {
  // Split on $$display$$ first, then $inline$, escaping everything between.
  const parts = paragraph.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return safeKatex(part.slice(2, -2), true);
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return safeKatex(part.slice(1, -1), false);
      }
      return escapeHtml(part);
    })
    .join('');
}

function safeKatex(expression: string, display: boolean): string {
  try {
    return katex.renderToString(expression, { displayMode: display, throwOnError: false });
  } catch {
    return escapeHtml(expression);
  }
}
