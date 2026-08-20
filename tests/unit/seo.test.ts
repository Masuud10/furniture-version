import { describe, expect, it } from 'vitest';

import { buildListingHref, parseListingParams } from '@/lib/catalog/listing-params';
import { isoDuration } from '@/lib/catalog/media-url';
import { findIndexableFacet, isFiltered } from '@/lib/seo/facets';
import { listingCanonical, truncate } from '@/lib/seo/urls';

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('A short summary', 155)).toBe('A short summary');
  });

  it('cuts on a word boundary and marks the cut', () => {
    const long = 'word '.repeat(60).trim();
    const result = truncate(long, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });

  it('collapses whitespace so a multi-line column does not leak newlines into a meta tag', () => {
    expect(truncate('one\n\ntwo   three')).toBe('one two three');
  });
});

describe('listingCanonical', () => {
  it('collapses page 1 to the bare category URL', () => {
    expect(listingCanonical('tables', 1)).toBe('/collections/tables');
  });

  it('keeps the page number on later pages, because they self-canonicalise', () => {
    expect(listingCanonical('tables', 3)).toBe('/collections/tables?page=3');
  });
});

describe('buildListingHref', () => {
  const base = parseListingParams('tables', {});

  it('omits every default, so the unfiltered listing is one URL and not a family', () => {
    expect(buildListingHref(base)).toBe('/collections/tables');
  });

  it('returns to page one when a filter changes', () => {
    const onPageFour = { ...base, page: 4 };
    expect(buildListingHref(onPageFour, { material: 'Oak' })).toBe(
      '/collections/tables?material=Oak',
    );
  });

  it('keeps the page when only the page changes', () => {
    expect(buildListingHref(base, { page: 2 })).toBe('/collections/tables?page=2');
  });

  it('toggles a filter off by passing null', () => {
    const filtered = { ...base, material: 'Oak' };
    expect(buildListingHref(filtered, { material: null })).toBe('/collections/tables');
  });
});

describe('parseListingParams', () => {
  it('rejects an unknown sort rather than trusting the query string', () => {
    expect(parseListingParams('tables', { sort: 'cheapest' }).sort).toBe('featured');
  });

  it('rejects an unknown price band', () => {
    expect(parseListingParams('tables', { price: 'free' }).priceBand).toBeNull();
  });

  it('clamps a nonsense page to 1', () => {
    expect(parseListingParams('tables', { page: '-4' }).page).toBe(1);
    expect(parseListingParams('tables', { page: 'abc' }).page).toBe(1);
  });

  it('matches a material case-insensitively against the known list', () => {
    expect(parseListingParams('tables', { material: 'oak' }, ['Oak', 'Walnut']).material).toBe('Oak');
  });

  it('drops a material that is not in the known list', () => {
    expect(parseListingParams('tables', { material: 'unobtainium' }, ['Oak']).material).toBeNull();
  });
});

describe('facet allowlist', () => {
  it('recognises an allowlisted facet', () => {
    expect(findIndexableFacet('tables', 'Mahogany')?.title).toBe('Solid mahogany tables');
  });

  it('does not recognise an arbitrary combination', () => {
    expect(findIndexableFacet('tables', 'Cane')).toBeNull();
    expect(findIndexableFacet('storage', 'Mahogany')).toBeNull();
  });

  it('treats a non-default sort as filtered, so it is not indexed', () => {
    const q = parseListingParams('tables', { sort: 'price-asc' });
    expect(isFiltered(q)).toBe(true);
  });

  it('treats the bare listing as unfiltered', () => {
    expect(isFiltered(parseListingParams('tables', {}))).toBe(false);
  });

  it('does not treat pagination alone as a filter — page 2 stays indexable', () => {
    expect(isFiltered(parseListingParams('tables', { page: '2' }))).toBe(false);
  });
});

describe('isoDuration', () => {
  it('formats seconds', () => {
    expect(isoDuration(18)).toBe('PT18S');
  });

  it('formats minutes and seconds', () => {
    expect(isoDuration(95)).toBe('PT1M35S');
  });

  it('never emits a negative duration', () => {
    expect(isoDuration(-3)).toBe('PT0S');
  });
});
