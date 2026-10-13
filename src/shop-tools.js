import fs from "node:fs";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { customers, orders, refunds } from "./data.js";

// ---------- Helpers ----------

// Structured error: what went wrong, and can it be retried?
function fail(category, message, retryable = false) {
  return { error: { category, retryable, message } };
}

// Turn a function's return value into the SDK's tool result format
function toResult(output) {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    isError: Boolean(output.error),
  };
}

// ---------- 1. The real work: plain functions, testable without AI ----------

export function lookupCustomer({ email, customer_id }) {
  if (!email && !customer_id) return fail("validation", "Provide an email or a customer_id.");

  const customer = customer_id
    ? customers[customer_id]
    : Object.values(customers).find((c) => c.email === email?.toLowerCase());
  if (!customer) return fail("not_found", "No customer matches that email or id.");

  const orderIds = Object.values(orders).filter((o) => o.customerId === customer.id).map((o) => o.id);
  return { ...customer, orderIds };
}

export function lookupOrder({ order_id }) {
  const order = orders[order_id];
  if (!order) return fail("not_found", `Order ${order_id} does not exist.`);
  return order;
}

export function processRefund({ order_id, amount, reason }) {
  if (!orders[order_id]) return fail("not_found", `Order ${order_id} does not exist.`);
  if (!(amount > 0)) return fail("validation", "Amount must be a positive number.");

  // No policy check here on purpose. The hooks enforce the policy.
  const refund = { refundId: `R-${refunds.length + 1}`, orderId: order_id, amount, reason };
  refunds.push(refund);
  return refund;
}

export function escalateToHuman(handoff) {
  const missing = ["customer_id", "summary", "root_cause", "recommended_action"].filter((k) => !handoff[k]);
  if (missing.length) return fail("validation", `Missing handoff fields: ${missing.join(", ")}`);

  const ticket = { ticketId: `T-${Date.now()}`, createdAt: new Date().toISOString(), status: "open", ...handoff };

  const dir = new URL("../tickets/", import.meta.url); // project root's tickets/ folder
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL(`${ticket.ticketId}.json`, dir), JSON.stringify(ticket, null, 2));

  return { ticketId: ticket.ticketId, status: "queued for a human" };
}

// ---------- 2. The SDK tools: name, description, schema, function ----------

const shopTools = [
  tool(
    "lookup_customer",
    "Finds a customer by email or customer id. Returns the customer and their order ids. Use this first to verify who you are talking to.",
    {
      email: z.string().optional().describe("e.g. 'amina@example.com'"),
      customer_id: z.string().optional().describe("e.g. 'C-101'"),
    },
    async (input) => toResult(lookupCustomer(input))
  ),

  tool(
    "lookup_order",
    "Gets one order: item, total, status and delivery details.",
    { order_id: z.string().describe("e.g. 'O-1001'") },
    async (input) => toResult(lookupOrder(input))
  ),

  tool(
    "process_refund",
    "Refunds an amount on an order. Follow the refund policy before calling this.",
    {
      order_id: z.string(),
      amount: z.number().describe("amount in dollars"),
      reason: z.string(),
    },
    async (input) => toResult(processRefund(input))
  ),

  tool(
    "escalate_to_human",
    "Hands the case to a human agent. The human will NOT see this chat, so every field must stand on its own.",
    {
      customer_id: z.string().describe("e.g. 'C-102', or 'unverified' if you could not verify the customer"),
      order_id: z.string().optional().describe("the order involved, if any"),
      amount: z.number().optional().describe("refund amount involved, if any"),
      summary: z.string().describe("what happened, as facts"),
      root_cause: z.string().describe("why you could not finish it yourself"),
      recommended_action: z.string().describe("what the human should do next"),
      already_tried: z.array(z.string()).optional().describe("steps you already took"),
    },
    async (input) => toResult(escalateToHuman(input))
  ),
];

// ---------- 3. One server holds all tools. Key in mcpServers must be "shop". ----------

export const shopServer = createSdkMcpServer({ name: "shop", version: "1.0.0", tools: shopTools });

export const TOOL_NAMES = [
  "mcp__shop__lookup_customer",
  "mcp__shop__lookup_order",
  "mcp__shop__process_refund",
  "mcp__shop__escalate_to_human",
];