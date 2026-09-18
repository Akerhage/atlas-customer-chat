const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const baseUrl = process.env.ATLAS_CHAT_PREVIEW_URL || "http://127.0.0.1:5173";
const outDir = path.resolve(process.env.ATLAS_KAN373_OUT || path.join("e2e", "screenshots", `kan373-quickq-touch-${Date.now()}`));
const repeatedQuestion = "Snabbfråge-test Onvia - Egen fråga";
const targetQuestion = "Hur fungerar era körlektioner för bil?";

function json(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function installRoutes(page, sentMessages) {
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/public/offices", route => route.fulfill(json([{
    id: 1,
    name: "Onvia",
    display_name: "Onvia Trafikskolor",
    city: "Göteborg",
    area: "Centrum",
    routing_tag: "onvia",
    categories_offered: ["BIL"],
  }])));
  await page.route("**/api/public/config", route => route.fulfill(json({
    ai_replies_enabled: true,
    industry_rag_enabled: true,
    chat_staffed: true,
    chat_reopens_label: null,
    chat_default_theme: "light",
  })));
  await page.route("**/api/tenant-name", route => route.fulfill(json({
    company_name: "Onvia Trafikskolor",
    support_display_name: "Support",
    active_vehicles: ["BIL"],
    quick_questions_with_metadata: [
      {
        text: repeatedQuestion,
        section_ref: [{ file: "basfakta_policy.json", id: "sec_001" }],
        vehicles: [],
        scope: "general",
        group_label: "EGNA FRÅGOR",
      },
      {
        text: repeatedQuestion,
        section_ref: [{ file: "basfakta_policy.json", id: "sec_002" }],
        vehicles: [],
        scope: "general",
        group_label: "EGNA FRÅGOR",
      },
      {
        text: targetQuestion,
        section_ref: [{ file: "basfakta_personbil_b.json", id: "sec_001" }],
        vehicles: ["BIL"],
        scope: "vehicle",
        group_label: "TJÄNSTER BIL",
      },
    ],
    tenant_profile: {
      schema_version: 1,
      edition: "trafikskola",
      modules: { structured_answers: false, industry_rag: true },
      intake: { mode: "legacy" },
    },
    category_registry: [],
  })));
  await page.route("**/api/public/templates/kundchatt", route => route.fulfill(json([])));
  await page.route("**/api/customer/history/**", route => route.fulfill(json({
    messages: [],
    human_mode: false,
    is_archived: false,
    close_reason: null,
  })));
  await page.route("**/api/customer/message", async route => {
    const body = route.request().postDataJSON();
    sentMessages.push(body?.message);
    await route.fulfill(json({
      answer: `Svar på: ${body?.message || ""}`,
      sessionId: body?.sessionId || "kan373_session",
      ownerToken: "kan373_owner",
      human_mode: false,
      is_archived: false,
    }));
  });
}

async function openQuestionPanel(page) {
  await page.getByTestId("chat-context-questions").waitFor({ state: "visible", timeout: 15000 });
  await page.getByTestId("chat-context-questions").click();
  await page.locator('[data-quick-question-item="question"]').first().waitFor({ state: "visible", timeout: 5000 });
}

async function runRetargetScenario(page) {
  await openQuestionPanel(page);
  return page.evaluate(({ targetQuestion }) => {
    const buttons = Array.from(document.querySelectorAll('button[data-quick-question-item="question"]'));
    const targetIndex = buttons.findIndex(button => button.getAttribute("data-quick-question-value") === targetQuestion);
    const target = buttons[targetIndex];
    const shiftedClickTarget = buttons[targetIndex - 1];
    if (!(target instanceof HTMLButtonElement) || !(shiftedClickTarget instanceof HTMLButtonElement)) {
      throw new Error("Could not find target question and shifted click target");
    }
    const targetRect = target.getBoundingClientRect();
    const shiftedRect = shiftedClickTarget.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 373,
      pointerType: "touch",
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
    }));
    shiftedClickTarget.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: shiftedRect.left + shiftedRect.width / 2,
      clientY: shiftedRect.top + shiftedRect.height / 2,
    }));
    return {
      targetText: target.textContent?.trim() || null,
      shiftedClickText: shiftedClickTarget.textContent?.trim() || null,
      targetRect: {
        x: targetRect.x,
        y: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
      },
      shiftedRect: {
        x: shiftedRect.x,
        y: shiftedRect.y,
        width: shiftedRect.width,
        height: shiftedRect.height,
      },
    };
  }, { targetQuestion });
}

async function runPhysicalTapScenario(page) {
  await openQuestionPanel(page);
  const target = page.locator(`[data-quick-question-value="${targetQuestion}"]`).first();
  const box = await target.boundingBox();
  if (!box) throw new Error("Target question has no bounding box");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return {
    targetRect: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
  };
}

async function runScenario(browser, mode) {
  const pixel7 = devices["Pixel 7"];
  const context = await browser.newContext({
    viewport: pixel7.viewport,
    deviceScaleFactor: pixel7.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const sentMessages = [];
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installRoutes(page, sentMessages);
  await page.addInitScript(() => {
    localStorage.setItem("chat_session_id", "kan373_session");
    localStorage.setItem("chat_owner_token", "kan373_owner");
    localStorage.setItem("chat_owner_token_session_id", "kan373_session");
  });
  await page.goto(`${baseUrl}/kundchatt/`, { waitUntil: "networkidle" });
  const interaction = mode === "retarget"
    ? await runRetargetScenario(page)
    : await runPhysicalTapScenario(page);
  await page.waitForFunction(
    expected => Array.from(document.querySelectorAll("*")).some(element => (element.textContent || "").includes(expected)),
    targetQuestion,
    { timeout: 5000 }
  );
  const screenshotPath = path.join(outDir, `${mode}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return {
    mode,
    sentMessages,
    interaction,
    screenshotPath,
    consoleErrors,
  };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const results = [
      await runScenario(browser, "retarget"),
      await runScenario(browser, "physical-tap"),
    ];
    for (const result of results) {
      if (result.sentMessages.at(-1) !== targetQuestion) {
        throw new Error(`${result.mode}: expected "${targetQuestion}", sent "${result.sentMessages.at(-1)}"`);
      }
    }
    const indexPath = path.join(outDir, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify({
      baseUrl,
      outDir,
      expectedMessage: targetQuestion,
      results,
    }, null, 2));
    console.log(JSON.stringify({ baseUrl, outDir, indexPath, expectedMessage: targetQuestion, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
