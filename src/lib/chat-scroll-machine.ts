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
