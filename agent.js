import Anthropic from "@anthropic-ai/sdk";
import { tools, handlers } from "./tools.js";
import { POLICY } from "./src/data.js";

const client = new Anthropic();
const MODEL = "claude-haiku-5-5";
const MAX_ITERATIONS = 20; // safety net only, never the stop signal

const SYSTEM = `You are ShopDesk, a support agent for a small online shop.
Help customers with orders, refunds and address changes using your tools.
Verify the customer with lookup_customer before changing anything.
${POLICY}
If a request breaks the policy or you cannot do it, use escalate_to_human.`;

function runTool(block) {
  const handler = handlers[block.name];
  const output = handler
    ? handler(block.input)
    : { error: { category: "validation", retryable: false, message: `Unknown tool: ${block.name}` } };

  return {
    type: "tool_result",
    tool_use_id: block.id,
    content: JSON.stringify(output),
    ...(output.error && { is_error: true }), // structured error -> flagged as a failed call
  };
}

export async function runAgent(userMessage) {
  const messages = [{ role: "user", content: userMessage }];

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages,
    });

    console.log(`[iter ${i}] stop_reason: ${res.stop_reason}`);
    messages.push({ role: "assistant", content: res.content }); // full turn, always

    if (res.stop_reason === "tool_use") {
      const results = [];
      for (const block of res.content.filter((b) => b.type === "tool_use")) {
        console.log(block);
        const result = runTool(block);
        console.log(`  ${block.name}(${JSON.stringify(block.input)}) -> ${result.content}`);
        results.push(result);
      }
      messages.push({ role: "user", content: results }); // one message, all results
      continue;
    }

    if (res.stop_reason === "end_turn") {
      return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }

    throw new Error(`Unhandled stop_reason: ${res.stop_reason}`); // max_tokens etc. is never "done"
  }

  console.warn(`WARNING: hit MAX_ITERATIONS (${MAX_ITERATIONS}) without end_turn`);
  return null;
}