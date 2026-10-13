import { lookupCustomer, lookupOrder, TOOL_NAMES } from "../shop-tools.js";

console.log(lookupCustomer({ email: "amina@example.com" }));
console.log(lookupOrder({ order_id: "O-9999" }));
console.log(TOOL_NAMES);