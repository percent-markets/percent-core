import React from 'react';

/**
 * Formats a plain text description by converting URLs into clickable links
 * while preserving the rest of the text formatting.
 */
export function formatDescription(text: string): React.ReactNode {
  if (!text) return null;

  // Regex to match URLs starting with http:// or https://
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
