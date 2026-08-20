'use server';

/**
 * Cart stub.
 *
 * The cart is a separate phase and is explicitly out of scope for the storefront.
 * This module exists so the product page can wire a real action to the real
 * button with the real signature, and so that phase can replace the body without
 * touching a single component.
 *
 * The signature is fixed by the handoff:
 *   (productId: string, variantId: string | null, qty: number) => Promise<Result>
 *
 * Note what is absent: there is no price argument. The browser may never assert a
 * price, and the way to guarantee that is to give it nothing to assert.
 */

export type Result =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function addToCart(
  productId: string,
  variantId: string | null,
  qty: number,
): Promise<Result> {
  if (!productId) {
    return { ok: false, message: 'That piece is no longer available. Try another finish.' };
  }
  if (!Number.isSafeInteger(qty) || qty < 1) {
    return { ok: false, message: 'Choose a quantity of at least one.' };
  }

  // Deliberately not implemented. The cart phase owns the write path; wiring a
  // half-cart here would be a second source of truth to unpick later.
  void variantId;

  return { ok: true, message: 'Added to cart.' };
}
