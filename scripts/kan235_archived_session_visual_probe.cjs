const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const baseUrl = process.env.ATLAS_CHAT_PREVIEW_URL || "http://127.0.0.1:4178";
const outDir = path.resolve(process.env.ATLAS_KAN235_OUT || path.join("e2e", "screenshots", `kan235-archived-session-${Date.now()}`));

const archivedHistory = {
  messages: [
    { role: "user", content: "Hej, jag vill fråga om riskutbildning." },
    { role: "atlas", content: "Jag hjälper dig gärna med riskutbildning." },
  ],
  human_mode: false,
  is_archived: true,
  close_reason: "inactivity",
};

const activeHistory = {
  messages: [
    { role: "user", content: "Hej, jag vill boka en lektion." },
    { role: "atlas", content: "Vi hjälper dig gärna vidare." },
  ],
  human_mode: false,
  is_archived: false,
  close_reason: null,
};

function json(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function installRoutes(page, history) {
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/public/offices", route => route.fulfill(json([
    {
      id: 1,
      name: "Testkontor",
      display_name: "Testkontor",
      city: "Göteborg",
      area: "Centrum",
      routing_tag: "testkontor",
      categories_offered: ["BIL"],
    },
  ])));
  await page.route("**/api/public/config", route => route.fulfill(json({
    ai_replies_enabled: true,
    industry_rag_enabled: true,
    chat_staffed: true,
    chat_reopens_label: null,
  })));
  await page.route("**/api/tenant-name", route => route.fulfill(json({
    company_name: "Atlas Visual Probe",
    support_display_name: "Support",
    active_vehicles: ["BIL"],
    quick_questions: [],
    tenant_profile: {
      schema_version: 1,
      edition: "trafikskola",
      modules: { structured_answers: false, industry_rag: true },
      intake: { mode: "legacy" },
    },
    category_registry: [],
  })));
  await page.route("**/api/public/templates/kundchatt", route => route.fulfill(json([])));
  await page.route("**/api/customer/history/**", route => route.fulfill(json(history)));
  await page.route("**/api/customer/message", route => route.fulfill(json({
    answer: "Tack, vi återkommer.",
    sessionId: "visual_session",
    human_mode: false,
    is_archived: false,
  })));
}

async function measurePassive(page, label, shouldDownload) {
  await page.goto(`${baseUrl}/kundchatt/`, { waitUntil: "networkidle" });
  await page.getByText("Denna konversation är avslutad.").waitFor({ state: "visible", timeout: 15000 });
  const dialog = page.getByRole("alertdialog");
  const bannerButton = page.getByRole("button", { name: "Spara kopia av chattloggen" });
  await bannerButton.waitFor({ state: "visible", timeout: 5000 });

  if (label.endsWith("-light")) {
    await page.getByRole("button", { name: "Ljust tema" }).click();
    await page.waitForTimeout(200);
  }

  const result = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Spara kopia av chattloggen"]');
    const archivedText = Array.from(document.querySelectorAll("span, p, div"))
      .find(el => (el.textContent || "").trim() === "Chatten har stängts automatiskt på grund av inaktivitet.");
    const rect = button?.getBoundingClientRect();
    const textRect = archivedText?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      dialogCount: document.querySelectorAll('[role="alertdialog"]').length,
      archivedText: archivedText?.textContent || null,
      buttonText: button?.textContent || null,
      buttonRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      archivedTextRect: textRect ? { x: textRect.x, y: textRect.y, width: textRect.width, height: textRect.height } : null,
    };
  });

  if (await dialog.count() !== 0) {
    throw new Error(`${label}: passive archived session opened an alert dialog`);
  }
  if (!result.buttonRect || result.buttonRect.width < 80 || result.buttonRect.height < 28) {
    throw new Error(`${label}: archived banner download button has an unsafe hit target`);
  }

  let downloadName = null;
  let downloadedTextIncludesHistory = null;
  if (shouldDownload) {
    const downloadPromise = page.waitForEvent("download");
    await bannerButton.click();
    const download = await downloadPromise;
    downloadName = download.suggestedFilename();
    const target = path.join(outDir, downloadName);
    await download.saveAs(target);
    downloadedTextIncludesHistory = fs.readFileSync(target, "utf8").includes("Jag hjälper dig gärna med riskutbildning.");
    await page.getByText("Denna konversation är avslutad.").waitFor({ state: "visible", timeout: 5000 });
    if (await dialog.count() !== 0) {
      throw new Error(`${label}: banner download reset or opened the dialog`);
    }
  }

  const screenshotPath = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { ...result, screenshotPath, downloadName, downloadedTextIncludesHistory };
}

async function measureActiveDialog(page, label) {
  await page.goto(`${baseUrl}/kundchatt/`, { waitUntil: "networkidle" });
  await page.getByText("Hej, jag vill boka en lektion.").waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: "Avsluta ärende" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await page.getByText("Ärendet avslutat").waitFor({ state: "visible", timeout: 5000 });
  const screenshotPath = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return await page.evaluate((screenshotPath) => {
    const dialog = document.querySelector('[role="alertdialog"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      dialogText: dialog?.textContent || null,
      dialogRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      screenshotPath,
    };
  }, screenshotPath);
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor || 1,
    isMobile: scenario.isMobile || false,
    hasTouch: scenario.hasTouch || false,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installRoutes(page, scenario.history);
  await page.addInitScript(() => {
    localStorage.setItem("chat_session_id", "visual_session");
    localStorage.setItem("chat_owner_token", "visual_owner");
    localStorage.setItem("chat_owner_token_session_id", "visual_session");
  });

  const result = scenario.active
    ? await measureActiveDialog(page, scenario.label)
    : await measurePassive(page, scenario.label, scenario.download);
  await context.close();
  return { ...result, consoleErrors };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const pixel7 = devices["Pixel 7"];
    const scenarios = [
      { label: "passive-mobile-dark", history: archivedHistory, viewport: pixel7.viewport, deviceScaleFactor: pixel7.deviceScaleFactor, isMobile: true, hasTouch: true, download: true },
      { label: "passive-mobile-light", history: archivedHistory, viewport: pixel7.viewport, deviceScaleFactor: pixel7.deviceScaleFactor, isMobile: true, hasTouch: true },
      { label: "passive-desktop-dark", history: archivedHistory, viewport: { width: 1280, height: 900 } },
      { label: "passive-desktop-light", history: archivedHistory, viewport: { width: 1280, height: 900 } },
      { label: "active-mobile-dialog", history: activeHistory, viewport: pixel7.viewport, deviceScaleFactor: pixel7.deviceScaleFactor, isMobile: true, hasTouch: true, active: true },
    ];
    const results = [];
    for (const scenario of scenarios) {
      results.push(await runScenario(browser, scenario));
    }
    const indexPath = path.join(outDir, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify({ baseUrl, outDir, results }, null, 2));
    console.log(JSON.stringify({ baseUrl, outDir, indexPath, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
