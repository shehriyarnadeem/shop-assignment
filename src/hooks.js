import fs from "node:fs";
import { customers, orders, refunds, AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS } from "./data.js";

// Audit file lands in the project root, wherever you run from
const AUDIT_FILE = new URL("../audit.jsonl", import.meta.url);

function audit(entry) {
  fs.appendFileSync(AUDIT_FILE, JSON.stringify({ time: new Date().toISOString(), ...entry }) + "\n");
}

// The SDK's shape for "block this tool call"
function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

const totalRefunded = (orderId) =>
  refunds.filter((r) => r.orderId === orderId).reduce((sum, r) => sum + r.amount, 0);

// A fresh set of hooks per run, so "who is verified" never leaks between runs
export function createHooks() {
  let verifiedCustomerId = null;

  // PostToolUse on lookup_customer: remember who was verified
  async function rememberCustomer(input) {
    const { email, customer_id } = input.tool_input;
    const customer = customer_id
      ? customers[customer_id]
      : Object.values(customers).find((c) => c.email === email?.toLowerCase());
    if (customer) verifiedCustomerId = customer.id;
    return {};
  }

  // PreToolUse on process_refund: gate 1 (verified) and gate 2 (policy)
  async function checkRefund(input) {
    const { order_id, amount } = input.tool_input;
    const order = orders[order_id];
    let reason = null;

    // Gate 1: who is asking?
    if (!verifiedCustomerId) reason = "Customer is not verified. Call lookup_customer first.";
    else if (!order) reason = `Order ${order_id} does not exist.`;
    else if (order.customerId !== verifiedCustomerId) reason = "This order belongs to a different customer.";
    // Gate 2: does the refund follow the policy?
    else if (order.status !== "delivered") reason = `Order is ${order.status}, not delivered.`;
    else if (order.deliveredDaysAgo > REFUND_WINDOW_DAYS)
      reason = `Delivered ${order.deliveredDaysAgo} days ago, outside the ${REFUND_WINDOW_DAYS}-day window.`;
    else if (totalRefunded(order_id) + amount > AUTO_REFUND_LIMIT)
      reason = `Total refund would be $${totalRefunded(order_id) + amount}, above the $${AUTO_REFUND_LIMIT} automatic limit.`;

    if (reason) {
      audit({ event: "denied", tool: input.tool_name, input: input.tool_input, reason });
      return deny(`${reason} Do not retry this refund. Use escalate_to_human if the customer needs more help.`);
    }
    return {};
  }

  // PostToolUse on every tool: the audit trail
  async function logToolCall(input) {
    audit({ event: "ran", tool: input.tool_name, input: input.tool_input, response: input.tool_response });
    return {};
  }

  return {
    PreToolUse: [{ matcher: "mcp__shop__process_refund", hooks: [checkRefund] }],
    PostToolUse: [
      { matcher: "mcp__shop__lookup_customer", hooks: [rememberCustomer] },
      { hooks: [logToolCall] }, // no matcher = every tool
    ],
  };
}