import { cn } from '@/lib/utils/cn';

/**
 * Paragraph rendering for the `_md` columns.
 *
 * Deliberately not a markdown library and deliberately not `dangerouslySetInnerHTML`:
 * the copy in this catalogue is paragraphs, and splitting on blank lines renders
 * them as text nodes, so there is no HTML injection surface at all. If the merchant
 * ever needs lists or emphasis, that is the moment to add a sanitising renderer —
 * not before.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className={cn('prose-copy flex max-w-(--measure) flex-col gap-4', className)}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="text-step-0 leading-relaxed text-ink">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
