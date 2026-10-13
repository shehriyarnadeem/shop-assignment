import { runAgent } from "../../agent.js";

const prompts = [
  "Where is order O-1002?",
  "I'm amina@example.com. Refund order O-1001, it arrived broken.",
  "I'm amina@example.com. Refund order O-9999.",
];

for (const p of prompts) {
  console.log(`\n===== ${p}`);
  console.log("ANSWER:", await runAgent(p));
}