export const SELF_HEAL_BACKOFF_MS = [0, 5_000, 15_000, 30_000, 60_000] as const;

export interface ArchivedSessionStatus {
  closeReason?: string | null;
  message?: string;
}

export interface PersistentSessionStatus {
  is_archived?: boolean;
  close_reason?: string | null;
  human_mode?: boolean;
}

export interface SessionStatusMachineSnapshot {
  archived: boolean;
  warningActive: boolean;
  countdownExpired: boolean;
  humanMode: boolean;
  running: boolean;
  attempts: number;
}

interface SessionStatusMachineOptions {
  poll: () => Promise<PersistentSessionStatus | null>;
  onArchived: (status: ArchivedSessionStatus) => void;
}

export interface SessionStatusMachine {
  startWarning: () => void;
  countdownExpired: () => void;
  visibilityChanged: (visible: boolean) => void;
  reconnected: () => void;
  customerActivity: () => void;
  setHumanMode: (humanMode: boolean) => void;
  archived: (status: ArchivedSessionStatus) => void;
  reset: () => void;
  destroy: () => void;
  snapshot: () => SessionStatusMachineSnapshot;
}

function inactivityMessage(closeReason: string | null | undefined): string | undefined {
  return closeReason === "inactivity"
    ? "Chatten har stängts automatiskt på grund av inaktivitet."
    : undefined;
}

export function createSessionStatusMachine({
  poll,
  onArchived,
}: SessionStatusMachineOptions): SessionStatusMachine {
  let archivedState = false;
  let warningActive = false;
  let countdownHasExpired = false;
  let humanModeState = false;
  let running = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let destroyed = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const stop = () => {
    generation += 1;
    clearTimer();
    running = false;
    attempts = 0;
  };

  const applyArchived = (status: ArchivedSessionStatus) => {
    if (archivedState || destroyed) return;
    stop();
    archivedState = true;
    warningActive = false;
    countdownHasExpired = false;
    onArchived({
      closeReason: status.closeReason ?? null,
      message: status.message ?? inactivityMessage(status.closeReason),
    });
  };

  const schedulePoll = (bounded: boolean, expectedGeneration: number) => {
    if (destroyed || archivedState || humanModeState || !running) {
      stop();
      return;
    }

    const delay = SELF_HEAL_BACKOFF_MS[attempts];
    timer = setTimeout(async () => {
      timer = null;
      if (expectedGeneration !== generation || destroyed || archivedState || humanModeState) return;

      let status: PersistentSessionStatus | null = null;
      try {
        status = await poll();
      } catch {
        // A transient failure follows the same bounded retry budget.
      }

      if (expectedGeneration !== generation || destroyed || archivedState || humanModeState) return;
      if (status?.is_archived) {
        applyArchived({
          closeReason: status.close_reason ?? null,
          message: inactivityMessage(status.close_reason),
        });
        return;
      }
      if (status?.human_mode) {
        humanModeState = true;
        stop();
        return;
      }

      attempts += 1;
      if (!bounded || attempts >= SELF_HEAL_BACKOFF_MS.length) {
        stop();
        return;
      }
      schedulePoll(true, expectedGeneration);
    }, delay);
  };

  const startPolling = (bounded: boolean) => {
    if (destroyed || archivedState || humanModeState || running) return;
    running = true;
    attempts = 0;
    generation += 1;
    schedulePoll(bounded, generation);
  };

  return {
    startWarning() {
      if (archivedState || destroyed) return;
      stop();
      warningActive = true;
      countdownHasExpired = false;
    },
    countdownExpired() {
      if (archivedState || destroyed) return;
      warningActive = true;
      countdownHasExpired = true;
      startPolling(true);
    },
    visibilityChanged(visible) {
      if (visible && warningActive) startPolling(true);
    },
    reconnected() {
      startPolling(warningActive || countdownHasExpired);
    },
    customerActivity() {
      stop();
      warningActive = false;
      countdownHasExpired = false;
    },
    setHumanMode(humanMode) {
      humanModeState = humanMode;
      if (humanMode) stop();
    },
    archived: applyArchived,
    reset() {
      stop();
      archivedState = false;
      warningActive = false;
      countdownHasExpired = false;
      humanModeState = false;
    },
    destroy() {
      destroyed = true;
      stop();
    },
    snapshot() {
      return {
        archived: archivedState,
        warningActive,
        countdownExpired: countdownHasExpired,
        humanMode: humanModeState,
        running,
        attempts,
      };
    },
  };
}
