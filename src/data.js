// ---------- Policy numbers: one source of truth ----------
// The prompt text and (in Phase 3) the hooks both import these.
export const AUTO_REFUND_LIMIT = 50;
export const REFUND_WINDOW_DAYS = 30;

// ---------- Customers, keyed by id ----------
export const customers = {
  "C-101": { id: "C-101", name: "Amina Khan", email: "amina@example.com" },
  "C-102": { id: "C-102", name: "Bilal Ahmed", email: "bilal@example.com" },
  "C-103": { id: "C-103", name: "Sara Malik", email: "sara@example.com" },
};

// ---------- Orders, keyed by id ----------
// deliveredDaysAgo is a number, so Phase 6 can edit it without dates drifting
export const orders = {
  "O-1001": { id: "O-1001", customerId: "C-101", item: "Desk lamp", total: 35, status: "delivered", deliveredDaysAgo: 5 },
  "O-1002": { id: "O-1002", customerId: "C-101", item: "Keyboard", total: 120, status: "shipped", arrivesInDays: 2 },
  "O-1003": { id: "O-1003", customerId: "C-102", item: "Headphones", total: 80, status: "delivered", deliveredDaysAgo: 12 },
  "O-1004": { id: "O-1004", customerId: "C-102", item: "Phone case", total: 20, status: "delivered", deliveredDaysAgo: 45 },
  "O-1005": { id: "O-1005", customerId: "C-101", item: "Backpack", total: 60, status: "processing" },
};

// ---------- Refunds issued during a run ----------
export const refunds = [];

// ---------- Policy text the model reads in its system prompt ----------
export const POLICY = `Refund policy:
- Only delivered orders can be refunded.
- Refunds are only allowed within ${REFUND_WINDOW_DAYS} days of delivery.
- Up to $${AUTO_REFUND_LIMIT} in total per order can be refunded automatically. Anything above that needs a human.`;

export function resetState() {
  refunds.length = 0;
}