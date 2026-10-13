import fs from "node:fs";
import { runSdkAgent } from "../sdk-agent.js";
import { resetState } from "../data.js";

const cases = [
  "I'm bilal@example.com. Refund order O-1003 in full, that's $80.", // over the limit
  "I'm amina@example.com. Get me a human, now.",                     // asked for a human
  "I'm sara@example.com. Please change my password.",                // no tool for it
];

// The tickets folder in the project root
const ticketsDir = new URL("../../tickets/", import.meta.url);

// 1. Empty the drawer, so everything in it afterwards is from this run
fs.rmSync(ticketsDir, { recursive: true, force: true });

// 2. Run the three cases
for (const c of cases) {
  resetState();
  console.log(`\n===== ${c}`);
  console.log("ANSWER:", await runSdkAgent(c, { useHooks: true }));
}

// 3. Print every ticket in the drawer
const tickets = fs.existsSync(ticketsDir) ? fs.readdirSync(ticketsDir) : [];

console.log(`\n${tickets.length} ticket(s):`);
for (const f of tickets) {
  console.log(fs.readFileSync(new URL(f, ticketsDir), "utf8"));
}