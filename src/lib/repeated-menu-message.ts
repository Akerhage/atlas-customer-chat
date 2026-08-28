export type MenuMessage = {
  role: string;
  content: string;
};

export const shouldSkipRepeatedMenuMessage = (
  messages: readonly MenuMessage[],
  nextContent: string,
): boolean => {
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.role === "assistant" && lastMessage.content === nextContent;
};
