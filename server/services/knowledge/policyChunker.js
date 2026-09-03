/**
 * Policy document chunking.
 *
 * Retrieval quality is decided here, not in the vector search. Two failure
 * modes this is shaped to avoid:
 *
 *  - Chunks too large: the embedding averages several unrelated statements
 *    ("deposit is 2 months" + "office hours are 10-7") into one vector that
 *    matches neither question well. Recall looks fine; precision is poor.
 *  - Chunks too small: "Two months." embeds without its subject and will match
 *    almost any numeric question.
 *
 * So: the paragraph is the unit. An agency writing its policies puts one rule
 * per paragraph, and that authored boundary is better evidence of where one
 * idea ends than any size heuristic we could impose. Paragraphs are NOT packed
 * together to hit a size target -- doing so averages "deposit is two months"
 * and "pets are not allowed" into a single vector that answers neither
 * question well. Paragraphs are only merged when one is too short to stand
 * alone, and only split when one exceeds the ceiling by itself.
 *
 * Every chunk is prefixed with the document title before embedding. A chunk
 * reading "Two months' rent, refundable within 30 days of vacating" is
 * ambiguous alone; "Security Deposit Policy. Two months' rent..." is not. The
 * prefix is part of the embedded text but is stored separately from chunkText
 * so it is not read aloud twice.
 */

/**
 * Target size used only when splitting a single over-long paragraph. It is not
 * a packing target: separate paragraphs are never combined to reach it.
 */
const TARGET_CHARS = 700;

/** Hard ceiling before a paragraph is sentence-split. */
const MAX_CHARS = 1000;

/**
 * Longest a paragraph can be and still be treated as a heading rather than a
 * rule. Paired with the punctuation test in `looksLikeHeading` -- length alone
 * is not a usable signal, because "Brokerage is one month rent plus GST." is a
 * complete rule in 67 characters and must keep its own vector.
 */
const HEADING_MAX_CHARS = 100;

/**
 * Sentences of trailing overlap carried into the next chunk. Overlap costs
 * storage and adds near-duplicate hits, but without it a rule split across a
 * boundary is retrievable from neither side.
 */
const OVERLAP_SENTENCES = 1;

/**
 * Split into sentences. Deliberately conservative: Indian policy text is full
 * of "Rs. 50,000", "2 B.H.K.", "Mr. Sharma", and a naive /\./ split shreds
 * them. Requires the period to be followed by whitespace and a capital or digit.
 */
function splitSentences(text) {
  const parts = text
    .replace(/([.!?])\s+(?=[A-Z0-9"'\u0900-\u097F])/g, '$1\u0000')
    .split('\u0000')
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length ? parts : [text.trim()].filter(Boolean);
}

/**
 * Is this paragraph a heading or list item rather than a standalone rule?
 *
 * The discriminator is terminal punctuation, not length. An author writing
 * "Security Deposit Policy" or "- Two months rent" does not end the line with a
 * full stop; an author stating a rule does. Getting this wrong in the lenient
 * direction merges unrelated rules into one averaged vector, which is the exact
 * failure this module exists to avoid.
 */
function looksLikeHeading(paragraph) {
  return paragraph.length <= HEADING_MAX_CHARS && !/[.!?]$/.test(paragraph);
}

/** Paragraph split on blank lines, falling back to single newlines. */
function splitParagraphs(text) {
  const byBlankLine = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) return byBlankLine;

  return text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Break an over-long paragraph on sentence boundaries, with overlap. */
function chunkLongParagraph(paragraph) {
  const sentences = splitSentences(paragraph);
  const chunks = [];
  let current = [];
  let length = 0;

  for (const sentence of sentences) {
    // A single sentence longer than the ceiling has no safe split point that
    // preserves meaning, so it is kept whole and truncated by the embedder.
    if (length > 0 && length + sentence.length > TARGET_CHARS) {
      chunks.push(current.join(' '));
      current = current.slice(-OVERLAP_SENTENCES);
      length = current.join(' ').length;
    }
    current.push(sentence);
    length += sentence.length + 1;
  }

  if (current.length) chunks.push(current.join(' '));
  return chunks.filter(Boolean);
}

/**
 * Chunk one policy document.
 *
 * @param {string} content   the raw policy text
 * @returns {string[]}       chunk texts, in document order
 */
export function chunkPolicyContent(content) {
  const text = String(content || '').trim();
  if (!text) return [];

  const paragraphs = splitParagraphs(text);
  const chunks = [];

  // `pending` holds heading and list-item lines waiting to attach to the rule
  // they introduce. This is the ONLY case where separate paragraphs combine.
  // Consecutive headings accumulate, which is what makes a bulleted list under
  // one heading come out as a single coherent chunk.
  let pending = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHARS) {
      const pieces = chunkLongParagraph(paragraph);
      if (pending && pieces.length) {
        pieces[0] = `${pending} ${pieces[0]}`;
        pending = '';
      }
      chunks.push(...pieces);
      continue;
    }

    const candidate = pending ? `${pending} ${paragraph}` : paragraph;

    // Keep accumulating headings/bullets, but never past the target size --
    // an unterminated list would otherwise grow into one unusable chunk.
    if (looksLikeHeading(paragraph) && candidate.length < TARGET_CHARS) {
      pending = candidate;
      continue;
    }

    chunks.push(candidate);
    pending = '';
  }

  // A short remainder attaches to the previous chunk rather than standing as
  // its own weak vector; if it is all there is, it stands alone.
  if (pending) {
    if (chunks.length) chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${pending}`;
    else chunks.push(pending);
  }

  return chunks;
}

/**
 * The text actually sent to the embedding model: title-prefixed so a chunk
 * carries its own subject. See the module note.
 */
export function buildChunkEmbeddingText(documentTitle, chunkText) {
  const title = String(documentTitle || '').trim();
  const body = String(chunkText || '').trim();
  if (!title) return body;
  return `${title}. ${body}`;
}

export default {
  chunkPolicyContent,
  buildChunkEmbeddingText,
  TARGET_CHARS,
  MAX_CHARS,
};
