import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goalEngine } from "../../src/agent/goals";
import { agent } from "../../src/agent/agent";
import { executor } from "../../src/agent/executor";

describe("Goal State Machine", () => {
  it("should create a goal with CREATED status", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test goal" });
    assert.strictEqual(goal.status, "CREATED");
  });
  it("should transition from CREATED to RUNNING", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test" });
    const started = goalEngine.start(goal.id);
    assert.strictEqual(started?.status, "RUNNING");
  });
  it("should complete a goal", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test" });
    goalEngine.start(goal.id);
    const completed = goalEngine.complete(goal.id);
    assert.strictEqual(completed?.status, "COMPLETED");
  });
  it("should fail a goal", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test" });
    goalEngine.start(goal.id);
    const failed = goalEngine.fail(goal.id, "test");
    assert.strictEqual(failed?.status, "FAILED");
  });
  it("should cancel a goal", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test" });
    goalEngine.start(goal.id);
    const cancelled = goalEngine.cancel(goal.id);
    assert.strictEqual(cancelled?.status, "CANCELLED");
  });
  it("should pause and resume", () => {
    const goal = goalEngine.create({ ownerId: "user1", description: "Test" });
    goalEngine.start(goal.id);
    const paused = goalEngine.pause(goal.id);
    assert.strictEqual(paused?.status, "PAUSED");
    const resumed = goalEngine.resume(goal.id);
    assert.strictEqual(resumed?.status, "RUNNING");
  });
});

describe("Executor", () => {
  it("should queue an action", async () => {
    const actionId = await executor.enqueue("goal1", "move_to", { x: 100, y: 64, z: 0 });
    assert.ok(actionId);
  });
});

describe("Agent", () => {
  it("should create a goal", async () => {
    const goal = await agent.createGoal("Test", "user1");
    assert.ok(goal.id);
  });
});
