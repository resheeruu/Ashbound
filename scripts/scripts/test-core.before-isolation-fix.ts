import { ConversationMemory } from "../src/ai/memory";
import { config } from "../src/config/env";

let passed = 0;
let failed = 0;

function pass(name: string) {
  console.log(`✅ ${name}`);
  passed++;
}

function fail(name: string, error?: unknown) {
  console.error(`❌ ${name}`, error ?? "");
  failed++;
}

console.log("\n🧪 AshenAI Core Offline Tests\n");

// ─────────────────────────────────────
// CONFIG
// ─────────────────────────────────────

try {
  if (config.ai.timeoutMs > 0) {
    pass("AI timeout configuration");
  } else {
    fail("AI timeout configuration");
  }

  if (config.ai.maxRetries >= 0) {
    pass("AI retry configuration");
  } else {
    fail("AI retry configuration");
  }

  if (config.ai.maxContextMessages >= 2) {
    pass("AI context configuration");
  } else {
    fail("AI context configuration");
  }
} catch (error) {
  fail("Configuration loading", error);
}

// ─────────────────────────────────────
// MEMORY
// ─────────────────────────────────────

try {
  const memory = new ConversationMemory();

  memory.add("test-user", {
    role: "user",
    content: "Hello",
  });

  const history = memory.get("test-user");

  if (
    history.length === 1 &&
    history[0].content === "Hello"
  ) {
    pass("Memory save and retrieve");
  } else {
    fail("Memory save and retrieve");
  }

  memory.add("test-user", {
    role: "assistant",
    content: "Hi!",
  });

  if (memory.get("test-user").length === 2) {
    pass("Memory conversation history");
  } else {
    fail("Memory conversation history");
  }

  memory.reset("test-user");

  if (memory.get("test-user").length === 0) {
    pass("Memory reset");
  } else {
    fail("Memory reset");
  }

  memory.add("user-a", {
    role: "user",
    content: "A",
  });

  memory.add("user-b", {
    role: "user",
    content: "B",
  });

  if (memory.stats().conversations === 2) {
    pass("Multiple conversation isolation");
  } else {
    fail("Multiple conversation isolation");
  }

  memory.clear();

  if (memory.stats().conversations === 0) {
    pass("Memory clear");
  } else {
    fail("Memory clear");
  }
} catch (error) {
  fail("Memory system", error);
}

// ─────────────────────────────────────
// RESULT
// ─────────────────────────────────────

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log("🎉 ALL CORE OFFLINE TESTS PASSED");
} else {
  console.log("❌ CORE TESTS FAILED");
  process.exit(1);
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
