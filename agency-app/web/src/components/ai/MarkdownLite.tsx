/**
 * A deliberately tiny Markdown renderer for AI replies.
 *
 * WHY NOT react-markdown: it would be a new runtime dependency, and the far
 * more important reason — every general-purpose Markdown renderer ultimately
 * produces HTML, which means raw-HTML passthrough is a configuration away from
 * being an XSS hole in a surface that renders **model output**. This renderer
 * builds React elements only. There is no `dangerouslySetInnerHTML` anywhere
 * in it, so a reply containing `<script>` renders as the literal text
 * `<script>` and can never execute.
 *
 * It supports exactly the subset the composer prompt asks the model to use
 * (see agency-app/api/agents/llm/composerPrompt.js): `##` sub-headings, `-`/`*` bullet
 * lists, `1.` numbered lists, `**bold**`, `*italic*`, and `` `code` ``.
 * Anything else falls through as plain text, which is the correct failure mode
 * — an unsupported construct looks slightly plain, it never breaks the panel.
 */

import { Fragment, type ReactNode } from 'react';

/** Split one line into bold / italic / code spans. Order matters: code first, so `**` inside a span stays literal. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // A single pass over the three inline forms. The alternation is ordered
  // longest-delimiter-first so `**bold**` is not mistaken for two italics.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: 2 | 3; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

/** Group lines into blocks. Consecutive list items become one list. */
function toBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];

    if (line.trim() === '') {
      // A blank line closes whatever block is open.
      if (last && last.kind === 'p') blocks.push({ kind: 'p', lines: [] });
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (last && last.kind === 'ul') last.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (last && last.kind === 'ol') last.items.push(numbered[1]);
      else blocks.push({ kind: 'ol', items: [numbered[1]] });
      continue;
    }

    if (last && last.kind === 'p' && last.lines.length > 0) last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
  }

  return blocks.filter((b) => b.kind !== 'p' || b.lines.length > 0);
}

export default function MarkdownLite({ text }: { text: string }) {
  if (!text) return null;
  const blocks = toBlocks(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        switch (block.kind) {
          case 'h':
            return block.level === 2 ? (
              <h3 key={key} className="pt-1 text-sm font-semibold text-slate-900">
                {renderInline(block.text, key)}
              </h3>
            ) : (
              <h4 key={key} className="pt-1 text-[13px] font-semibold text-slate-800">
                {renderInline(block.text, key)}
              </h4>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc space-y-1 pl-5 marker:text-slate-400">
                {block.items.map((item, ii) => (
                  <li key={`${key}-${ii}`}>{renderInline(item, `${key}-${ii}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal space-y-1 pl-5 marker:text-slate-400">
                {block.items.map((item, ii) => (
                  <li key={`${key}-${ii}`}>{renderInline(item, `${key}-${ii}`)}</li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={key} className="whitespace-pre-wrap break-words">
                {block.lines.map((line, li) => (
                  <Fragment key={`${key}-${li}`}>
                    {li > 0 && <br />}
                    {renderInline(line, `${key}-${li}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
