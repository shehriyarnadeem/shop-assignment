import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const res = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 200,
  messages: [{ role: "user", content: "Say hi in 3 words." }],
});

console.log(res.stop_reason, res.content);