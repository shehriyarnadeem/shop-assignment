import { query } from "@anthropic-ai/claude-agent-sdk";
  import { shopServer, TOOL_NAMES } from "./shop-tools.js";
import { createHooks } from "./hooks.js";
import { POLICY } from "./data.js";

const SYSTEM = `You are ShopDesk, a support agent for a small online shop.
Help customers with orders, refunds and address changes using your tools.
Verify the customer with lookup_customer before changing anything.
${POLICY}

Escalate with escalate_to_human when:
- the request breaks the refund policy, or a refund was denied
- the customer asks for a human
- you cannot do it with your tools (for example passwords or account settings)
- you have tried twice and made no progress
Do not escalate just because you feel unsure. Try your tools first.

The human will not see this chat. Write the summary as facts, the root cause as why you could not finish, and the recommended action as the human's next step.
After escalating, give the customer the ticket id and say a human will follow up.`;

export async function runSdkAgent(userMessage, { useHooks = false, quiet = false } = {}) {
  let answer = null;

  for await (const msg of query({
    prompt: userMessage,
    options: {
      systemPrompt: SYSTEM,
      mcpServers: { shop: shopServer },
      tools: [],
      allowedTools: TOOL_NAMES,
      model: "haiku",
      maxBudgetUsd: 0.3,
      ...(useHooks && { hooks: createHooks() }), // only when asked
    },
  })) {
    if (msg.type === "assistant" && !quiet) {
      for (const block of msg.message.content) {
        if (block.type === "tool_use") console.log(`  ${block.name}(${JSON.stringify(block.input)})`);
      }
    }

    if (msg.type === "result") {
      if (!quiet) console.log(`  [${msg.subtype}, cost $${msg.total_cost_usd}]`);
      if (msg.subtype === "success") answer = msg.result;
    }
  }

  return answer;
}