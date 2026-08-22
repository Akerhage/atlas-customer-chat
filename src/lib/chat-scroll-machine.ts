export function resolveInitialHistoryHadMessages(
  historyMessageCount: number | null,
  hasOwnerToken: boolean,
): boolean | null {
  if (historyMessageCount !== null) return historyMessageCount > 0;
  return hasOwnerToken ? null : false;
}

export function shouldStartNewChatAtTop({
  initialHistoryLoaded,
  initialScrollHandled,
  initialHistoryHadMessages,
  humanMode,
  messageCount,
}: {
  initialHistoryLoaded: boolean;
  initialScrollHandled: boolean;
  initialHistoryHadMessages: boolean | null;
  humanMode: boolean;
  messageCount: number;
}): boolean {
  return initialHistoryLoaded
    && !initialScrollHandled
    && initialHistoryHadMessages === false
    && !humanMode
    && messageCount > 0;
}
