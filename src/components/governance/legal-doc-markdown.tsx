import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`${match.index}-em`} className="text-foreground/80">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|");
}

function isTableDivider(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMetadataLine(line: string): boolean {
  return /^\*\*[^*]+:\*\*/.test(line.trim());
}

function parseBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1
          key={`h1-${index}`}
          className="mt-10 scroll-mt-24 border-b border-border/60 pb-3 text-2xl font-semibold tracking-tight first:mt-0"
        >
          {parseInline(trimmed.slice(2))}
        </h1>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`} className="mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-foreground">
          {parseInline(trimmed.slice(3))}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`} className="mt-6 scroll-mt-24 text-base font-semibold text-foreground">
          {parseInline(trimmed.slice(4))}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${index}`} className="my-8 border-border/60" />);
      index += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableRow(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      const header = parseTableRow(tableLines[0] ?? "");
      const bodyRows = tableLines.slice(1).filter((row) => !isTableDivider(row)).map(parseTableRow);

      blocks.push(
        <div key={`table-${index}`} className="mt-6 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead className="bg-surface-2/80 text-foreground">
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-4 py-3 font-medium tracking-tight">
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {bodyRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 text-muted-foreground">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (isMetadataLine(trimmed)) {
      const metadataLines: string[] = [];
      while (index < lines.length && isMetadataLine(lines[index].trim())) {
        metadataLines.push(lines[index].trim());
        index += 1;
      }

      blocks.push(
        <div
          key={`meta-${index}`}
          className="mt-4 grid gap-x-8 gap-y-2 rounded-lg border border-border/60 bg-surface-1/30 px-4 py-3 text-sm text-muted-foreground sm:grid-cols-2"
        >
          {metadataLines.map((metaLine, metaIndex) => (
            <div key={metaIndex} className="leading-relaxed">
              {parseInline(metaLine)}
            </div>
          ))}
        </div>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        current.startsWith("#") ||
        /^---+$/.test(current) ||
        isTableRow(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`} className="mt-4 text-muted-foreground">
        {parseInline(paragraphLines.join(" "))}
      </p>,
    );
  }

  return blocks;
}

export function LegalDocMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <article
      className={cn(
        "legal-doc-prose max-w-none text-[15px] leading-relaxed text-foreground/90",
        className,
      )}
    >
      {parseBlocks(content).map((block, index) => (
        <Fragment key={index}>{block}</Fragment>
      ))}
    </article>
  );
}
