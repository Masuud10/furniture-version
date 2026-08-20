/**
 * One component, one escape, no string concatenation anywhere else.
 *
 * The `<` escape is not optional: a `</script>` sequence inside product copy
 * would otherwise close the tag and turn the rest of the page into markup the
 * browser executes. Escaping `<` to `<` is valid inside a JSON string and
 * makes that impossible.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
