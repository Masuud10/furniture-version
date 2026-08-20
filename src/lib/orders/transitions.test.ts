import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_REASONS,
  HAPPY_PATH,
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  canMarkPaid,
  canTransition,
  incrementsNoShowCount,
  isTerminal,
  nextTransitions,
  reasonLabel,
  requiresReason,
  statusLabel,
  type OrderStatus,
} from './transitions';

describe('the transition table', () => {
  it('matches the row count in the migration', () => {
    // Twelve rows are inserted in 20260820090300_commerce.sql. If that number
    // changes without this one changing, the mirror has drifted.
    expect(TRANSITIONS).toHaveLength(12);
  });

  it('references only real statuses', () => {
    for (const t of TRANSITIONS) {
      expect(ORDER_STATUSES).toContain(t.from);
      expect(ORDER_STATUSES).toContain(t.to);
    }
  });

  it('has no self-transition', () => {
    // The database enforces this with a check constraint. So does this.
    for (const t of TRANSITIONS) {
      expect(t.from).not.toBe(t.to);
    }
  });

  it('has no duplicate pair', () => {
    const seen = TRANSITIONS.map((t) => `${t.from}->${t.to}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('gives every non-terminal status somewhere to go', () => {
    for (const status of ORDER_STATUSES) {
      if (isTerminal(status)) continue;
      expect(nextTransitions(status).length).toBeGreaterThan(0);
    }
  });

  it('labels every transition', () => {
    for (const t of TRANSITIONS) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      // Sentence case, one job per label.
      expect(t.label).not.toMatch(/^[a-z]/);
      expect(t.label).not.toMatch(/[.!]$/);
    }
  });
});

describe('terminal states', () => {
  it('cannot be left', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(nextTransitions(status)).toHaveLength(0);
    }
  });

  it('are exactly cancelled and returned', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['cancelled', 'returned']);
  });

  it('reports terminality correctly', () => {
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('returned')).toBe(true);
    expect(isTerminal('delivered')).toBe(false);
    expect(isTerminal('pending_confirmation')).toBe(false);
  });
});

describe('the illegal moves the database rejects', () => {
  const illegal: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
    ['pending_confirmation', 'delivered'],
    ['pending_confirmation', 'in_production'],
    ['pending_confirmation', 'ready_for_delivery'],
    ['confirmed', 'delivered'],
    ['confirmed', 'out_for_delivery'],
    ['in_production', 'delivered'],
    ['cancelled', 'confirmed'],
    ['cancelled', 'pending_confirmation'],
    ['returned', 'delivered'],
    ['delivered', 'cancelled'],
    ['delivered', 'out_for_delivery'],
  ];

  it.each(illegal)('refuses %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('the moves that must be allowed', () => {
  it('walks the happy path end to end', () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i += 1) {
      const from = HAPPY_PATH[i] as OrderStatus;
      const to = HAPPY_PATH[i + 1] as OrderStatus;
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('lets a failed delivery attempt go back to the queue', () => {
    // Routine, and it must not need a cancellation to be modelled.
    expect(canTransition('out_for_delivery', 'ready_for_delivery')).toBe(true);
  });

  it('lets a delivered order be returned', () => {
    expect(canTransition('delivered', 'returned')).toBe(true);
  });

  it('allows cancellation from every state before delivery', () => {
    const beforeDelivery: OrderStatus[] = [
      'pending_confirmation',
      'confirmed',
      'in_production',
      'ready_for_delivery',
      'out_for_delivery',
    ];
    for (const status of beforeDelivery) {
      expect(canTransition(status, 'cancelled')).toBe(true);
    }
  });
});

describe('reason codes', () => {
  it('are required for every ending', () => {
    for (const t of TRANSITIONS) {
      if (t.to === 'cancelled' || t.to === 'returned') {
        expect(t.requiresReason).toBe(true);
      }
    }
  });

  it('are not required for ordinary progress', () => {
    expect(requiresReason('pending_confirmation', 'confirmed')).toBe(false);
    expect(requiresReason('out_for_delivery', 'delivered')).toBe(false);
    expect(requiresReason('out_for_delivery', 'ready_for_delivery')).toBe(false);
  });

  it('reports false for a transition that does not exist', () => {
    expect(requiresReason('cancelled', 'delivered')).toBe(false);
  });

  it('counts only a no-show against the customer', () => {
    expect(incrementsNoShowCount('customer_no_show')).toBe(true);
    for (const reason of CANCELLATION_REASONS) {
      if (reason === 'customer_no_show') continue;
      expect(incrementsNoShowCount(reason)).toBe(false);
    }
  });

  it('gives every reason a label a merchant would recognise', () => {
    for (const reason of CANCELLATION_REASONS) {
      expect(reasonLabel(reason).trim().length).toBeGreaterThan(0);
    }
  });
});

describe('payment', () => {
  it('can be recorded only on a delivered order', () => {
    expect(canMarkPaid('delivered', 'unpaid')).toBe(true);
    expect(canMarkPaid('out_for_delivery', 'unpaid')).toBe(false);
    expect(canMarkPaid('confirmed', 'unpaid')).toBe(false);
    expect(canMarkPaid('cancelled', 'unpaid')).toBe(false);
  });

  it('is not offered twice', () => {
    expect(canMarkPaid('delivered', 'paid')).toBe(false);
  });
});

describe('labels', () => {
  it('exist for every status and read as plain English', () => {
    for (const status of ORDER_STATUSES) {
      const label = statusLabel(status);
      expect(label.trim().length).toBeGreaterThan(0);
      // No snake_case leaking into anything a customer reads.
      expect(label).not.toMatch(/_/);
    }
  });
});
