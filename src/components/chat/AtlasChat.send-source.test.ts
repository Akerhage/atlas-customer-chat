import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type SendSource = "quick-action" | "menu" | "textarea";

const atlasChatPath = path.resolve(process.cwd(), "src", "components", "chat", "AtlasChat.tsx");
const expectedSourceByHandler: Readonly<Record<string, SendSource>> = Object.freeze({
  handleQuickAction: "quick-action",
  handleChoiceSelected: "menu",
  handleInputSend: "textarea",
});

function enclosingHandlerName(node: ts.Node): string {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  }
  return "";
}

function inspectHandleSendMessageCalls() {
  const sourceText = fs.readFileSync(atlasChatPath, "utf8");
  const sourceFile = ts.createSourceFile(atlasChatPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls: Array<{ handler: string; source: string; line: number; argumentCount: number }> = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "handleSendMessage"
    ) {
      const sourceArgument = node.arguments[2];
      calls.push({
        handler: enclosingHandlerName(node),
        source: sourceArgument && ts.isStringLiteral(sourceArgument) ? sourceArgument.text : "",
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        argumentCount: node.arguments.length,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

describe("AtlasChat send-source callsite classification", () => {
  it("classifies every handleSendMessage call and binds its source to the owning handler", () => {
    const calls = inspectHandleSendMessageCalls();
    const violations = calls.flatMap((call) => {
      const expected = expectedSourceByHandler[call.handler];
      if (!expected) return [`line ${call.line}: unclassified handler ${call.handler || "<none>"}`];
      if (call.argumentCount !== 3 || !call.source) return [`line ${call.line}: ${call.handler} lacks an explicit send source`];
      if (call.source !== expected) return [`line ${call.line}: ${call.handler} sends ${call.source}, expected ${expected}`];
      return [];
    });

    expect(violations).toEqual([]);
    expect(calls).toHaveLength(4);
    expect(calls.map(({ handler, source }) => ({ handler, source }))).toEqual([
      { handler: "handleQuickAction", source: "quick-action" },
      { handler: "handleChoiceSelected", source: "menu" },
      { handler: "handleChoiceSelected", source: "menu" },
      { handler: "handleInputSend", source: "textarea" },
    ]);
  });
});
