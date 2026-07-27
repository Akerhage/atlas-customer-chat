import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SELF_HEAL_BACKOFF_MS,
  createSessionStatusMachine,
  type ArchivedSessionStatus,
} from "./session-status-machine";

afterEach(() => {
  vi.useRealTimers();
});

function archived(closeReason = "inactivity"): ArchivedSessionStatus {
  return { closeReason, message: "Chatten har stängts automatiskt på grund av inaktivitet." };
}

describe("session status machine", () => {
  it("self-heals a Standard session that missed the socket archive event", async () => {
    vi.useFakeTimers();
    const onArchived = vi.fn();
    const poll = vi.fn()
      .mockResolvedValueOnce({ is_archived: false, human_mode: false })
      .mockResolvedValueOnce({ is_archived: true, close_reason: "inactivity", human_mode: false });
    const machine = createSessionStatusMachine({ poll, onArchived });

    machine.startWarning();
    machine.countdownExpired();
    await vi.advanceTimersByTimeAsync(SELF_HEAL_BACKOFF_MS[0]);
    await vi.advanceTimersByTimeAsync(SELF_HEAL_BACKOFF_MS[1]);

    expect(poll).toHaveBeenCalledTimes(2);
    expect(onArchived).toHaveBeenCalledOnce();
    expect(onArchived).toHaveBeenCalledWith(archived());
  });

  it("keeps the normal online socket archive path immediate", () => {
    const onArchived = vi.fn();
    const machine = createSessionStatusMachine({
      poll: vi.fn(),
      onArchived,
    });

    machine.archived(archived("deleted"));

    expect(onArchived).toHaveBeenCalledOnce();
    expect(onArchived).toHaveBeenCalledWith({
      closeReason: "deleted",
      message: "Chatten har stängts automatiskt på grund av inaktivitet.",
    });
  });

  it("does not stack self-heal polling on the existing human-mode polling", async () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const machine = createSessionStatusMachine({ poll, onArchived: vi.fn() });

    machine.setHumanMode(true);
    machine.startWarning();
    machine.countdownExpired();
    machine.reconnected();
    await vi.runAllTimersAsync();

    expect(poll).not.toHaveBeenCalled();
  });

  it("checks persistent status on reconnect", async () => {
    vi.useFakeTimers();
    const onArchived = vi.fn();
    const poll = vi.fn().mockResolvedValue({
      is_archived: true,
      close_reason: "deleted",
      human_mode: false,
    });
    const machine = createSessionStatusMachine({ poll, onArchived });

    machine.reconnected();
    await vi.runAllTimersAsync();

    expect(poll).toHaveBeenCalledOnce();
    expect(onArchived).toHaveBeenCalledWith({
      closeReason: "deleted",
      message: undefined,
    });
  });

  it("cancels pending self-heal when customer activity clears the warning", async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({ is_archived: false, human_mode: false });
    const onArchived = vi.fn();
    const machine = createSessionStatusMachine({ poll, onArchived });

    machine.startWarning();
    machine.countdownExpired();
    await vi.advanceTimersByTimeAsync(SELF_HEAL_BACKOFF_MS[0]);
    machine.customerActivity();
    await vi.runAllTimersAsync();

    expect(poll).toHaveBeenCalledOnce();
    expect(onArchived).not.toHaveBeenCalled();
    expect(machine.snapshot().warningActive).toBe(false);
  });

  it("applies archive effects only once when two paths race", () => {
    const onArchived = vi.fn();
    const machine = createSessionStatusMachine({ poll: vi.fn(), onArchived });

    machine.archived(archived());
    machine.archived(archived());

    expect(onArchived).toHaveBeenCalledOnce();
    expect(machine.snapshot().archived).toBe(true);
  });

  it("stops after the bounded backoff budget", async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({ is_archived: false, human_mode: false });
    const machine = createSessionStatusMachine({ poll, onArchived: vi.fn() });

    machine.startWarning();
    machine.countdownExpired();
    await vi.runAllTimersAsync();

    expect(poll).toHaveBeenCalledTimes(SELF_HEAL_BACKOFF_MS.length);
    expect(machine.snapshot().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("checks again when a warned background tab becomes visible", async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({ is_archived: false, human_mode: false });
    const machine = createSessionStatusMachine({ poll, onArchived: vi.fn() });

    machine.startWarning();
    machine.visibilityChanged(false);
    machine.visibilityChanged(true);
    await vi.runAllTimersAsync();

    expect(poll).toHaveBeenCalledTimes(SELF_HEAL_BACKOFF_MS.length);
  });
});
