import React from 'react';

/**
 * Renders basic markdown formatting (bold, code, lists, linebreaks) cleanly without external dependencies.
 */
export const FormattedMessage = ({ content = '' }) => {
  if (!content) return null;

  // Split into paragraphs by double newlines
  const paragraphs = content.split(/\n\n+/);

  const formatInline = (text) => {
    // Regex for bold (**text**) and inline code (`code`)
    const parts = [];
    let remaining = text;
    let keyIdx = 0;

    // Pattern matching either `code` or **bold**
    const inlineRegex = /(`([^`]+)`|\*\*([^*]+)\*\*)/;

    while (remaining) {
      const match = inlineRegex.exec(remaining);
      if (!match) {
        parts.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      const matchIndex = match.index;
      if (matchIndex > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, matchIndex)}</span>);
      }

      if (match[0].startsWith('`')) {
        // Inline code
        parts.push(
          <code
            key={keyIdx++}
            className="px-1.5 py-0.5 rounded bg-cream text-olive-deep font-mono text-xs border border-beige"
          >
            {match[2]}
          </code>
        );
      } else if (match[0].startsWith('**')) {
        // Bold
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-olive-deep">
            {match[3]}
          </strong>
        );
      }

      remaining = remaining.slice(matchIndex + match[0].length);
    }

    return parts;
  };

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-ink">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n');

        // Check if paragraph is an ordered or unordered list
        const isList = lines.every((line) => /^\s*(\d+\.|\*|-)\s+/.test(line));

        if (isList) {
          const isOrdered = /^\s*\d+\.\s+/.test(lines[0]);
          const ListTag = isOrdered ? 'ol' : 'ul';
          return (
            <ListTag
              key={pIdx}
              className={`space-y-1.5 my-2 ${isOrdered ? 'list-decimal' : 'list-disc'} pl-5 text-ink`}
            >
              {lines.map((line, lIdx) => {
                const itemContent = line.replace(/^\s*(\d+\.|\*|-)\s+/, '');
                return <li key={lIdx}>{formatInline(itemContent)}</li>;
              })}
            </ListTag>
          );
        }

        return (
          <p key={pIdx}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {formatInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedMessage;
