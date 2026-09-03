import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatHeaderSource = readFileSync(new URL("./ChatHeader.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatInputSource = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatBubbleSource = readFileSync(new URL("./ChatBubble.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const contactFormSource = readFileSync(new URL("./ContactFormDialog.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const contextBarSource = readFileSync(new URL("./ChatContextBar.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const quickQuestionsSource = readFileSync(new URL("./QuickQuestionsButton.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const menuScrollAreaSource = readFileSync(new URL("./MenuScrollArea.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const atlasClientSource = readFileSync(new URL("../../lib/atlas-client.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const intakeMachineSource = readFileSync(new URL("../../lib/intake-machine.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function blockHashIn(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return createHash("sha256").update(src.slice(start, end)).digest("hex");
}

function blockHash(startMarker: string, endMarker: string): string {
  return blockHashIn(source, startMarker, endMarker);
}

describe("AtlasChat intake-order contract", () => {
  // K7c (2026-07-26): vakten låg tidigare på AI_OFF_WELCOME_MESSAGE_CONTENT i
  // AtlasChat.tsx. Den ytan var DÖD sedan 44cc0d5 (2026-07-12), som flyttade
  // välkomsttexten till resolveWidgetTexts() — vakten skrevs 32cb32b
  // (2026-07-16), alltså mot en kvarglömd tvilling av den riktiga copyn.
  // Skyddet är däremot verkligt: detta är trafik-editionens (Box1-3)
  // välkomsttext, som inte får glida under Box4-arbete. Vakten är därför
  // FLYTTAD hit, inte struken — och täcker nu hela LEGACY_TEXTS, dvs. även
  // welcomeAiOn som den gamla vakten missade.
  // #311/L-038 (2026-08-17): baslinjen flyttad från
  // 5b4a91d7367ff721f5d73bcf1de9da0e0ed9d3ea5fbd1959e39a0208e2bdfa85 eftersom Patrik
  // beslutat att templatesTitle heter "Kundinformation" i BÅDA verksamhetstyperna.
  // 🔴 Vaktens OMFATTNING är oförändrad — den hashar fortfarande hela LEGACY_TEXTS,
  // inte ett smalare block. Endast den godkända baslinjen är ny. Mätt inför bytet:
  // diffen inne i blocket är EXAKT en rad (templatesTitle); welcomeAiOn, welcomeAiOff,
  // templatesSubtitle och headerSubtitle är byte-identiska. Sänk aldrig vakten till ett
  // mindre block för att slippa pinna om den.
  it("keeps the approved G6-8b legacy (trafik) widget texts byte-identical", () => {
    expect(blockHashIn(intakeMachineSource, "const LEGACY_TEXTS", "export function resolveWidgetTexts"))
      .toBe("1030e1e331bf8b03fc4bcef12853b7e2618576b2f14030ece5d3f02c9d84e1f3");
  });

  // Vakt över det som FAKTISKT renderas: välkomstbubblan läser widget-texterna,
  // och de döda konstanterna får inte återuppstå som en andra sanning.
  it("renders the welcome message from resolveWidgetTexts, not from local constants", () => {
    expect(source).toContain("const createWelcomeMessage = (aiRepliesEnabled: boolean, texts = resolveWidgetTexts(undefined)): ChatMessage => ({");
    expect(source).toContain("content: aiRepliesEnabled ? texts.welcomeAiOn : texts.welcomeAiOff,");
    expect(source).toContain("setMessages([createWelcomeMessage(aiRepliesEnabled, widgetTexts)]);");
    // G6-8: ingen call site får hårdkoda AI-flaggan tillsammans med widgetTexts.
    expect(source).not.toContain("createWelcomeMessage(false, widgetTexts)");
    // G6-8c lägger till den fjärde call siten: post-config seed för legacy AI-PÅ-tenants.
    expect(source.match(/createWelcomeMessage\(aiRepliesEnabled, widgetTexts\)/g)).toHaveLength(4);
    // Profilbyte skriver om den redan visade välkomstbubblan ur widget-texterna.
    expect(source).toContain("? { ...message, content: aiRepliesEnabled ? widgetTexts.welcomeAiOn : widgetTexts.welcomeAiOff }");
    expect(source).not.toContain("WELCOME_MESSAGE_CONTENT");
    expect(source).not.toContain("getWelcomeMessageContent");
  });

  it("builds the office-hours notice from the shared copy helper, not a local constant", () => {
    expect(source).toContain("import { buildOfficeHoursNoticeText } from \"../../lib/office-hours-notice\";");
    expect(source).toContain("return buildOfficeHoursNoticeText({");
    expect(source).toContain("quickQuestionsAvailable: intakeMode === 'legacy' && aiRepliesEnabled && quickQuestions.some((question) => question.trim().length > 0),");
    expect(source).toContain("aiAssistantAvailable: aiRepliesEnabled && !selfserviceFreeTextBlocked,");
    expect(source).not.toContain("Snabbfrågorna och AI-assistenten hjälper dig gärna under tiden.");
  });

  it("keeps raw company names separate from Atlas display fallback", () => {
    expect(atlasClientSource).toContain("companyNameRaw: string | null;");
    expect(atlasClientSource).toContain("companyNameRaw: null");
    expect(atlasClientSource).toContain("const companyNameRaw =");
    expect(atlasClientSource).toContain("companyNameRaw,");
  });

  it("renders the tenant company name in the header and assistant bubbles with an Atlas fallback", () => {
    // KAN-112: assertionen pinnade hela klasslistan och gick röd när headern fick
    // `truncate`. Testets avsikt är att FÖRETAGSNAMNET renderas som rubrik — inte vilka
    // utility-klasser rubriken bär. Regeln är därför omskriven mot avsikten: h1:n ska
    // fortfarande vara en rubrik (`font-semibold`) och bära `{displayName}`, men nya
    // layoutklasser ska inte ge falskt rött.
    expect(chatHeaderSource).toContain('font-semibold leading-tight text-foreground"');
    expect(chatHeaderSource).toContain('>{displayName}</h1>');
    expect(chatBubbleSource).toContain("companyName?: string | null;");
    expect(chatBubbleSource).toContain("const displayName = isUser ? 'Du' : (senderName || companyName || 'Atlas');");
    expect(source).toContain("senderName={message.senderName}\ncompanyName={companyName}");
  });

  it("plumbs the raw tenant support display name without an Atlas fallback", () => {
    expect(atlasClientSource).toContain("supportDisplayName: string | null;");
    expect(atlasClientSource).toContain("supportDisplayName: null");
    expect(atlasClientSource).toContain("const supportDisplayName =");
    expect(atlasClientSource).toContain("supportDisplayName,");
    expect(source).toContain("const [supportDisplayName, setSupportDisplayName] = useState<string | null>(null);");
    expect(source).toContain("setSupportDisplayName(config.supportDisplayName);");
  });

  it("does not render legacy welcome copy before live config has loaded", () => {
    expect(source).toContain("const bootstrapping = !publicConfigLoaded || !tenantConfigLoaded;");
    expect(source).toContain("const [messages, setMessages] = useState<ChatMessage[]>([]);");
    expect(source).not.toContain("createWelcomeMessage(true, initialWidgetTexts)");
  });

  it("seeds exactly one welcome bubble after config load, including legacy AI-on tenants", () => {
    expect(source).toContain("const welcomeSeededRef = useRef(false);");
    expect(source).toContain("if (welcomeSeededRef.current) return;");
    expect(source).toContain("if (bootstrapping) return;");
    expect(source).toContain("welcomeSeededRef.current = true;");
    expect(source).toContain("setMessages((prev) => prev.length === 0");
    expect(source).toContain("? [createWelcomeMessage(aiRepliesEnabled, widgetTexts)]");
  });

  it("uses the existing typing indicator for bootstrapping without coupling it to flow state", () => {
    expect(source).toContain("subtitleLoading={bootstrapping}");
    expect(source).toContain("bootstrapping || isTyping");
    expect(source).toContain("<TypingIndicator agentName={typingAgentName} />");
    expect(source).not.toContain("setIsTyping(bootstrapping)");
    expect(chatHeaderSource).toContain("subtitleLoading?: boolean;");
    expect(chatHeaderSource).toContain("subtitleLoading ? '' : subtitle");
    expect(chatHeaderSource).toContain("min-h-4");
  });

  it("keeps the tenant name visible and recoverable on common mobile widget widths", () => {
    expect(chatHeaderSource).toContain('className="hidden min-[360px]:block min-w-0" data-testid="chat-header-tenant-name"');
    expect(chatHeaderSource).not.toContain('className="hidden min-[380px]:block min-w-0"');
    expect(chatHeaderSource).toContain('className="hidden min-[360px]:line-clamp-2 break-words font-semibold leading-tight text-foreground"');
    expect(chatHeaderSource).toContain('data-testid="chat-header-tenant-title"');
    expect(chatHeaderSource).toContain('title={displayName}');
    // Tvingad underrubrik gav 81px header vid 440/441px och vid 470px med
    // fem åtgärdsknappar. Behåll 560px-gränsen så widgetens 72px-tak står.
    expect(chatHeaderSource).toContain("min-[560px]:block");
  });

  it("keeps the slice-24 handoff implementation byte-identical", () => {
    expect(blockHash("const finishIntakeHandoff", "const handleChoiceSelected"))
      .toBe("88318a8e03322d4fcfaa3e85fffa976d62468fe103d57338821b2edbdea9e885");
  });

  // 7 -> 8 i KAN-275 rev 2: startBlockedFreeTextFlow() startar ärendevägen när
  // Standard saknar både självservice och fritextmotor. Vakten är oförändrad i sak
  // — varje literal start går fortfarande genom den lägesstyrda startIntake().
  it("routes all eight literal intake starts through the mode-gated starter", () => {
    expect(source.match(/startIntake\('/g)).toHaveLength(8);
    expect(source).toContain("const firstStep = buildIntakeOrder(intakeMode, categoryChoices.length, hasKnownOfficeForIntake())[0];");
    expect(source).toContain("if (firstStep === 'office') {");
  });

  it("routes backend-requested contact intake through the same starter", () => {
    expect(source).toContain("if (response.contact_intake_required) {");
    expect(source).toContain("startIntake(response.answer || 'För att kunna koppla dig till rätt person behöver jag några uppgifter. Vad heter du?');");
  });

  it("uses office-filtered category choices for standard intake paths", () => {
    expect(source).toContain("filterCategoryChoicesForOffice(categoryChoices, office?.categories_offered)");
    expect(source).toContain("const categoryChoicesForOffice = getCategoryChoicesForOfficeLabel(value);");
    expect(source).toContain("injectBotMessage('Vad gäller ärendet?', categoryChoicesForOffice);");
    expect(source).toContain("const choices = getCategoryChoicesForIntake();");
    expect(source).toContain("if (choices.length === 0) {");
  });

  it("keeps empty selfservice category choices escapable instead of buttonless", () => {
    expect(source).toContain("STANDARD_EMPTY_CATEGORY_MESSAGE,");
    // #167/L-037: meddelandet bar tenantens kategoriord sedan 2026-08-31 och byggs
    // darfor av en funktion. Vakten galler ESKALERINGSVAGEN, inte ordet — den binds
    // om till byggaren i stallet for att krava Atlas standardord.
    expect(source).toContain(
      "content: buildStandardEmptyCategoryMessage(resolveChatCategoryPluralWord(tenantProfile)),",
    );
    expect(source).toContain("choices: withEscalationValue([])");
    expect(source).toContain("const categoryStep = getStandardCategoryStep(requestedUnitId);");
    expect(source).toContain("if (choices.length > 0) {");
    expect(source).toContain("finishIntakeHandoff({\n...nextIntakeData,\ncity: isCentralSupport ? 'Centralsupport' : getOfficeDisplayName(safeOffice!),\nvehicle: null,\ngeneral: true,");
  });

  it("consumes the shared Standard unit and contact-recipient copy", () => {
    // Kravet är att copyn kommer från den DELADE konstanten, inte att anropet ser ut
    // på ett visst sätt. Enhetssteget bär sedan Patriks beslut 2026-08-19 dessutom
    // eskaleringen (se kontraktet om utvägen nedan), så argumentet är inlindat.
    expect(source).toContain("injectBotMessage(STANDARD_UNIT_PROMPT,");
    expect(source).toContain("getStandardUnitChoices()");
    expect(contactFormSource).toContain('{!categoryFormMode && <SelectLabel');
    expect(contactFormSource).toContain('placeholder={`Välj ${formLabels.unit.toLowerCase()}`}');
    expect(contactFormSource).toContain('{`Välj ${formLabels.unit.toLowerCase()}`}</SelectLabel>');
    expect(contactFormSource).not.toContain('placeholder="Välj kontor"');
    expect(contactFormSource).not.toContain('>Välj Kontor</SelectLabel>');
  });

  it("keeps the contact form phone copy honest about callbacks", () => {
    expect(contactFormSource).toContain("Lägg till mobilnummer (valfritt)");
    expect(contactFormSource).toContain("Vill du bli uppringd? Skriv det tydligt i meddelandet.");
    expect(contactFormSource).toContain('placeholder="070 123 45 67"');
    expect(contactFormSource).not.toContain("Jag vill bli uppringd");
  });

  it("gives every customer-chat header action a stable accessible name", () => {
    expect(contactFormSource).toContain('aria-label="Skicka meddelande"');
    expect(chatHeaderSource).toContain('aria-label="Prata med människa"');
    expect(chatHeaderSource).toContain('aria-label={isDark ? "Ljust tema" : "Mörkt tema"}');
    expect(chatHeaderSource).toContain('aria-label="Avsluta ärende"');
  });

  it("never tells a standard customer to type while selfservice free text is blocked", () => {
    expect(source).toContain(
      "showCompactStandardMenuFollowup('Okej, ärendet avbröts. Du hittar alternativen i menyn nere vid skrivfältet.');",
    );
    expect(source).not.toContain("Skriv gärna om du har fler frågor!");
    expect(source).toContain(
      "{' '}— {selfserviceFreeTextBlocked ? 'välj ett alternativ' : 'skriv något'} för att hålla den öppen.",
    );
    expect(source).toContain("shouldBlockSelfserviceFreeText({");
    expect(source).toContain("profile: tenantProfile,");
    expect(source).toContain("aiRepliesEnabled,");
    expect(source).toContain("intakeActive: Boolean(intakeStep),");
    expect(source).toContain("if (selfserviceFreeTextBlocked) {");
  });

  it("shows the shared quick-question button immediately in parallel selfservice mode", () => {
    // Kravet är oförändrat: frågeknappen ska finnas DIREKT, inte först efter kundens
    // första meddelande. Mekanismen bytte 2026-08-19 (Patriks beslut) — knappen bor nu
    // i kontrollraden i stället för bakom ett showQuickQuestions-villkor i ChatInput.
    //
    // 🔴 Negativ + positiv kontroll i par: att det gamla villkoret är borta bevisar
    // ingenting på egen hand, så vi kräver också att knappen faktiskt renderas.
    expect(source).not.toContain("showQuickQuestions=");
    expect(source).toContain("questionsControl={(");
    expect(source).toContain("<QuickQuestionsButton");
    // Raden — och därmed knappen — får inte villkoras på antal meddelanden.
    expect(source).toContain(
      "const showContextBar = !isArchived && !humanMode && !intakeStep;",
    );
    expect(source).toContain(
      "const standardSelfserviceMenuStage = standardSelfserviceAvailable && !standardSelfserviceExclusive && selfserviceStage === null",
    );
  });

  it("keeps the always-visible context bar as the single writer per context field", () => {
    // Patriks beslut 2026-08-19: EN väljare per sak. Mätt orsak (sandbox, live):
    // två väljare i samma panel kände inte till varandra, och ett enhetsklick
    // nollställde fordonet så att 5 rubriker / 21 frågor försvann ur listan.
    expect(source).toContain("<ChatContextBar");
    // Enhetsbytet ska BEHÅLLA kategori/fordon som den nya enheten erbjuder.
    expect(source).toContain("const keptCategoryId = selectedCategoryId");
    expect(source).toContain("officeOffersVehicle(office, selectedVehicle)");
    // Väljaren får inte döljas vid singleton — det var orsaken till att boxarna
    // såg olika ut. ChatContextBar renderar kontrollen även utan alternativ.
    expect(contextBarSource).toContain("const isDisabled = disabled || choices.length === 0;");
    expect(contextBarSource).not.toContain("singletonOffice");
    // Listan är en LISTA: enhets-/kategorival får inte krypa tillbaka in i den.
    expect(quickQuestionsSource).toContain(
      "const selfserviceActions = standardSelfserviceMenu.map(item => ({",
    );
    expect(quickQuestionsSource).not.toContain("standardUnitChoices");

    // 🔴🔴 ID-rymden är DELAD: Box4 använder `MC` som slug för "Muttrar och Skruvar"
    // och `BIL` för "Spikar och järn". Kategori→fordon-speglingen får därför ALDRIG
    // köras i Standard. Livemätt fel 2026-08-19: window.selectedVehicle blev `MC` på
    // en skruvfabrik. getSafeActiveVehicle skyddar inte — `MC` är ett giltigt aktivt
    // fordon även där. Grinden måste läsa editionen.
    expect(source).toContain("const isStandardEditionTenant = tenantProfile?.edition === 'standard';");
    expect(source).toContain(": getSafeActiveVehicle(requestedCategoryId);");

    // 🔴 F1: att SÄTTA fordonet räcker inte — det gamla måste RENSAS när kunden väljer
    // en egen kategori i Trafik. Den oberoende granskningen påpekade att pinnen ovan
    // inte kunde fånga det, och den fångade det inte heller. Detta är den saknade halvan.
    expect(source).toContain("const clearsVehicle = !isStandardEditionTenant && !asVehicle;");
    expect(source).toContain("} else if (clearsVehicle) {");
    expect(source).toContain("...(clearsVehicle ? { vehicle: null, vehicle_choice: 'OVRIGT', clear_vehicle: true } : {}),");

    // Pillret och listan måste läsa SAMMA enhet, annars filtrerar listan inte förrän
    // kunden klickat på den enhet pillret redan visar som vald (mätt på Box3: `Bil`
    // försvann först efter klicket).
    expect(source).toContain("const effectiveContextUnitId = selfserviceUnitId");
    expect(source).toContain("getStandardCategoryChoices(effectiveContextUnitId)");
    expect(source).toContain("getCategoryChoicesForOfficeLabel(selectedCity || context.city)");
    expect(source).toContain("buildLegacyContextBarCategoryChoices(");
    expect(source).toContain("findSafeOfficeFromLiveContext(offices, value, context) || singletonOffice");
  });
  it("holds the three context pills to identical widget-width measurements", () => {
    // KAN-119 (2026-08-20): kontrollraden bröt till TVÅ rader i den 380px breda
    // inbäddade widgeten. Fixen krympte gap/padding under 440px och dolde
    // chevronen — men måtten skrevs för hand i TVÅ filer: ChatContextSelect här
    // i ChatContextBar.tsx och triggern i QuickQuestionsButton.tsx. De tre
    // pillarna delar EN rad; glider måtten isär vid nästa ändring bryts raden
    // igen, och inget test fångade det. Mätt live 2026-08-20: inre radhöjd 26px
    // och EN rad på alla fem boxar — den mätningen är det denna vakt skyddar.
    const pillClasses = (src: string): string[] => {
      const line = src
        .split("\n")
        .find((row) => row.includes("max-w-[min(11rem,44vw)]"));
      expect(line, "hittade ingen pill-klassrad").toBeTruthy();
      return (line as string)
        .replace(/^[^"]*"/, "")
        .replace(/",?\s*$/, "")
        .split(/\s+/)
        // text-xs bärs av radens container i ChatContextBar och inline i
        // QuickQuestionsButton — samma renderade storlek, olika plats.
        .filter((token) => token !== "text-xs")
        .sort();
    };

    const barPill = pillClasses(contextBarSource);
    const questionsPill = pillClasses(quickQuestionsSource);

    // 🔴 Positiv kontroll först: en ren jämförelse mellan två listor är grön även
    // om BÅDA tappat de mått som håller raden på en rad.
    for (const token of [
      "min-w-0",
      "gap-0.5",
      "min-[440px]:gap-1",
      "px-1.5",
      "min-[440px]:px-2",
    ]) {
      expect(barPill).toContain(token);
    }
    expect(questionsPill).toEqual(barPill);

    // Chevronen döljs under 440px i BÅDA — det var den som inte fick plats.
    for (const src of [contextBarSource, quickQuestionsSource]) {
      expect(src).toContain('className="hidden min-[440px]:block w-3 h-3 shrink-0');
    }
    // Raden får inte brytas: flex-wrap var själva orsaken till tvåradersfelet.
    expect(contextBarSource).toContain("flex flex-nowrap items-center");
    expect(contextBarSource).not.toContain("flex flex-wrap items-center");
  });

  it("keeps human support reachable when exclusive selfservice hides free text", () => {
    expect(source).toContain("onRequestHuman={handleRequestHuman}");
    expect(chatInputSource).toContain("onRequestHuman: () => void;");
    expect(chatInputSource).toContain('aria-label="Prata med människa"');
    expect(chatInputSource).toContain('title="Prata med människa"');
    expect(chatInputSource).toContain("{hideFreeText && (");
    expect(chatInputSource).toContain("onClick={onRequestHuman}");
    expect(chatInputSource).toContain("flex-shrink-0");
  });

  it("keeps the Standard welcome steps but moves final subject questions exclusively to the footer panel", () => {
    expect(source).toContain("injectBotMessage(STANDARD_UNIT_PROMPT,");
    // #167/L-037: ordet ar tenantens. Kontraktet laser resolveranropet.
    expect(source).toContain(
      "? { content: `Välj ${resolveChatCategoryWord(tenantProfile).toLocaleLowerCase('sv-SE')}.`, choices }",
    );

    const menuStart = source.indexOf("const showStandardMenu = (");
    const menuEnd = source.indexOf("const showCompactStandardMenuFollowup", menuStart);
    expect(menuStart).toBeGreaterThanOrEqual(0);
    expect(menuEnd).toBeGreaterThan(menuStart);
    const menuSource = source.slice(menuStart, menuEnd);

    // L-098: samma API-array ska fortfarande mata Frågor & tjänster, men inte
    // dupliceras som stora choice-knappar i den sista chattbubblan.
    expect(menuSource).toContain("setSelfserviceMenu(items);");
    expect(menuSource).toContain("withEscalationChoice([])");
    expect(menuSource).not.toContain("withEscalationChoice(items)");
    // #167/L-037: chippets namn bar tenantens tjansteord i plural.
    expect(menuSource).toContain(
      "Välj en fråga i Frågor & ${resolveChatOfferingPluralWord(tenantProfile).toLocaleLowerCase('sv-SE')} nere vid skrivfältet",
    );

    // 🔴 #167: meningen ovan NAMNGER chippet. Star de tva isar sager chatten "valj i
    // Frågor & behandlingar" medan chippet fortfarande heter "Frågor & tjänster".
    // Mutationsprovet 2026-08-31 visade att den kopplingen var OVAKTAD: att ta bort
    // triggerLabel-propen gav ingen rod. Darfor pinnas propen har.
    expect(source).toContain(
      "triggerLabel={`Frågor & ${resolveChatOfferingPluralWord(tenantProfile).toLocaleLowerCase('sv-SE')}`}",
    );
    expect(quickQuestionsSource).toContain(
      "const selfserviceActions = standardSelfserviceMenu.map(item => ({",
    );
  });

  // #455/KAN-209. `repeated-menu-message.test.ts` testar predikatet ISOLERAT, vilket inte
  // bevisar att det är inkopplat. Mätt 2026-08-28 under Claudes oberoende granskning: med
  // anropet borttaget ur showStandardMenu var sviten fortfarande `217/217` grön och buggen
  // — sex identiska menyrutor efter sju kategoribyten — var tillbaka utan ett enda rött test.
  // Denna vakt binder kopplingen, gränsen och statusuppdateringen till källan.
  it("wires the repeated-menu guard into showStandardMenu without silencing real answers", () => {
    expect(source).toContain('import { shouldSkipRepeatedMenuMessage } from "@/lib/repeated-menu-message";');
    // Spegeln måste vara effekt-baserad: fyra ställen skriver HELA meddelandelistan
    // (serverhistorik och välkomståterställning), och en ref som missar dem blir stale.
    expect(source).toContain("messagesRef.current = messages;");

    const menuStart = source.indexOf("const showStandardMenu = (");
    const menuEnd = source.indexOf("const showCompactStandardMenuFollowup", menuStart);
    const menuSource = source.slice(menuStart, menuEnd);
    expect(menuSource).toContain("shouldSkipRepeatedMenuMessage(messagesRef.current, nextContent)");
    // Menyns state ska uppdateras ÄVEN när bubblan hoppas över — annars slutar
    // kontrollradens frågelista följa kategorin.
    expect(menuSource.indexOf("setSelfserviceMenu(items);"))
      .toBeLessThan(menuSource.indexOf("shouldSkipRepeatedMenuMessage"));
    expect(menuSource.indexOf("setSelfserviceStage('menu');"))
      .toBeLessThan(menuSource.indexOf("shouldSkipRepeatedMenuMessage"));

    // 🔴 Gränsen: dedupen gäller BARA menybubblan. Riktiga svar och de händelsestyrda
    // beskeden ska alltid synas, även när kunden klickar samma snabbfråga igen.
    const followupStart = source.indexOf("const showCompactStandardMenuFollowup");
    const followupEnd = source.indexOf("const loadAndShowStandardMenu", followupStart);
    expect(source.slice(followupStart, followupEnd)).not.toContain("shouldSkipRepeatedMenuMessage");
    expect(source).toContain("injectBotMessage(response.presentation || response.answer || STANDARD_EMPTY_MESSAGE);");
  });

  it("opens all footer controls upward and caps the question list to a scrollable mobile viewport", () => {
    expect(contextBarSource).toContain('side="top"');
    expect(contextBarSource).toContain("sideOffset={8}");
    expect(quickQuestionsSource).toContain('side="top" sideOffset={8}');
    expect(quickQuestionsSource).toContain("<MenuScrollArea>");
    expect(menuScrollAreaSource).toContain("max-h-[min(20rem,60dvh)]");
    expect(menuScrollAreaSource).toContain("[&>[data-radix-scroll-area-viewport]]:max-h-[min(20rem,60dvh)]");
  });

  it("clears all three legacy vehicle holders on an incompatible office change without marking a general choice", () => {
    const start = source.indexOf("const handleCityChange");
    const end = source.indexOf("const messagesEndRef", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain("resolveVehicleForOffice(nextOffice, selectedVehicle)");
    expect(block).toContain("setSelectedVehicle(nextVehicle)");
    expect(block).toContain("window.selectedVehicle = nextVehicle");
    expect(block).toContain("vehicle: nextVehicle");
    expect(block).not.toContain("vehicle_choice: 'OVRIGT'");
    expect(block).not.toContain("clear_vehicle: true");
  });

  it("only permits selfservice session recovery outside human mode and intake", () => {
    expect(source).toContain("const humanModeRef = useRef(humanMode);");
    expect(source).toContain("const intakeStepRef = useRef(intakeStep);");
    expect(source).toContain(
      "canRecoverSession: () => !humanModeRef.current && !intakeStepRef.current,",
    );
    expect(source).toContain(
      "injectBotMessage(response.presentation || response.answer || STANDARD_EMPTY_MESSAGE);",
    );
  });

  it("routes all four archive sources through the shared idempotent transition", () => {
    const archiveCalls = source.match(/applyArchivedState\(\{/g) || [];
    expect(archiveCalls).toHaveLength(4);
    expect(source).toContain("if (isArchivedStandardSelfserviceAnswerError(error)) {");
    expect(source).toContain("onChoiceSelect={isArchived ? undefined : handleChoiceSelected}");
    expect(source).toContain("sessionStatusMachineRef.current.reconnected();");
    expect(source).toContain("document.addEventListener('visibilitychange', handleVisibilityChange);");
    expect(source.match(/clearInactivityWarningForCustomerActivity\(\);/g)).toHaveLength(2);
  });

  it("keeps the generic selfservice error only for non-archive failures", () => {
    const catchStart = source.indexOf("} catch (error) {", source.indexOf("const handleStandardChoice"));
    const catchEnd = source.indexOf("} finally {", catchStart);
    const catchBlock = source.slice(catchStart, catchEnd);

    expect(catchBlock).toContain("isArchivedStandardSelfserviceAnswerError(error)");
    expect(catchBlock).toContain("applyArchivedState({");
    expect(catchBlock).toContain(
      "showCompactStandardMenuFollowup('Svaret kunde inte hämtas just nu. Försök igen via menyn nere vid skrivfältet eller skapa ett ärende.');",
    );
    expect(catchBlock.indexOf("applyArchivedState({"))
      .toBeLessThan(catchBlock.indexOf("showCompactStandardMenuFollowup("));
  });

  it("allows standard unit reselection with in-place update before category and reset after", () => {
    expect(source).toContain("const selfserviceUnitMessageIdRef = useRef<string | null>(null);");
    expect(source).toContain("selfserviceStage === 'category' && !selectedCategoryId && !intakeStep");
    expect(source).toContain("message.id === selfserviceUnitMessageIdRef.current");
    expect(source).toContain("requestedUnitId && selfserviceStage !== 'unit'");
    expect(source).toContain("setSelectedCategoryId(null);");
    expect(source).toContain("setIntakeStep(null);");
  });

  // K7/C (Patrik-beslut 2026-07-25): utvägen heter "Vet inte / allmän fråga",
  // ligger SIST och är visuellt skild — men MEKANIKEN är oförändrad.
  it("keeps the escape hatch reachable outside the unit list, still on the office=NULL value", () => {
    // 🔴 ERSÄTTER kontraktet som pinnade utvägen SIST I ENHETSLISTAN (K7/C 2026-07-25).
    // Patriks beslut 2026-08-19 flyttade den: "den vet inte/allmän fråga är väldigt
    // förvirrande för mig". Den låg i en lista över AVDELNINGAR och lästes som ännu en
    // avdelning, fast den betyder "ingen avdelning" — och dess kategoristeg kunde
    // aldrig ge något svar (#325 F1).
    //
    // Vad som ändrades: PLATSEN. Vad som INTE fick ändras: mekaniken som ger
    // office = NULL ⇒ Inkorgen (routes/team.js:388-390, LOCK [2/3]).
    const start = source.indexOf("const getStandardUnitChoices");
    const end = source.indexOf("const getCategoryChoicesForOffice", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    // Enhetslistan bär bara riktiga enheter.
    expect(block).toContain("offices.map((office) => ({");
    expect(block).not.toContain("STANDARD_CENTRAL_SUPPORT_LABEL");
    expect(block).not.toContain("fullWidth: true");

    // POSITIV KONTROLL: utvägen finns i stället på enhetssteget, som eskalering.
    expect(source).toContain("withEscalationValue(getStandardUnitChoices())");
    // ...och den får inte falla ur tyst när ingen enhet är vald — det är just det
    // läge knappen nu står i. 'Centralsupport' är värdet som ger office = NULL.
    expect(source).toContain("(selfserviceUnitLabel || 'Centralsupport')");
    expect(source).not.toContain("if (!city) return;");

    // MEKANIKVAKT, oförändrad: sentinelen lever kvar där den JÄMFÖRS, och gamla
    // sessioner som redan valt den måste fortsätta fungera.
    expect(source).toContain("unitId === STANDARD_CENTRAL_SUPPORT");
    expect(source).toContain("intakeData.city === 'Centralsupport'");
    // Etiketten mappas fortfarande vid RENDERINGEN, inte i värdet. Pinnas på
    // mekanismen och inte på radbrytningen — uttrycket flyttade in i kontrollradens
    // label när raden byggdes 2026-08-19.
    expect(source).toContain("selfserviceUnitId === STANDARD_CENTRAL_SUPPORT");
    expect(source).toContain("? STANDARD_CENTRAL_SUPPORT_LABEL");
    // Kunden ska aldrig läsa det interna ordet.
    expect(block).not.toContain("label: 'Centralsupport'");
  });

  it("shows the tenant support label in legacy intake without changing the office=NULL sentinel", () => {
    const start = source.indexOf("const getOfficeChoices");
    const end = source.indexOf("const getStandardUnitChoices", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain("label: supportDisplayName || 'Supportavdelningen'");
    expect(block).toContain("value: 'Centralsupport'");
    expect(block).not.toContain("label: 'Centralsupport'");
    expect(source).toContain("injectUserMessage(value === 'Centralsupport' ? supportDisplayName || 'Supportavdelningen' : value);");
    expect(source).toContain("supportDisplayName={supportDisplayName}");
    expect(chatHeaderSource).toContain("supportDisplayName?: string | null;");
    expect(chatHeaderSource).toContain("supportDisplayName={supportDisplayName}");
    expect(contactFormSource).toContain("supportDisplayName?: string | null;");
    expect(contactFormSource).toContain("<SelectItem value={DEFAULT_CITY} className=\"font-bold\">{supportDisplayName || 'Supportavdelningen'}</SelectItem>");
  });

  it("reselects a different category from menu without rewriting the preserved category bubble", () => {
    const start = source.indexOf("const isMidIntakeCategoryReselection");
    const end = source.indexOf("if (selfserviceStage === 'unit')", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain("selfserviceStage === 'menu' && !intakeStep");
    expect(block).toContain("if (requestedCategoryId === selectedCategoryId) return true;");
    expect(block.indexOf("requestedCategoryId === selectedCategoryId"))
      .toBeLessThan(block.indexOf("loadAndShowStandardMenu"));
    expect(block).toContain("getStandardCategoryChoices(selfserviceUnitId)");
    expect(block).toContain("setSelfserviceMenu([]);");
    expect(block).toContain("setSelectedCategoryId(requestedCategoryId);");
    expect(block).toContain("category_id: requestedCategoryId");
    expect(block).toContain("injectUserMessage(category.label);");
    expect(block).toContain("await loadAndShowStandardMenu(selfserviceUnitId, requestedCategoryId);");
    expect(block).not.toContain("setMessages(");
    expect(block).not.toContain("selfserviceCategoryMessageIdRef");
  });

  it("routes category reselection during intake and resets intake before loading the new menu", () => {
    const start = source.indexOf("const isMidIntakeCategoryReselection");
    const end = source.indexOf("if (selfserviceStage === 'unit')", start);
    const block = source.slice(start, end);
    const routeStart = source.indexOf("if (\nstandardSelfserviceAvailable &&\n!humanMode &&\nintakeStep");
    const routeEnd = source.indexOf("if (!intakeStep)", routeStart);
    const routeBlock = source.slice(routeStart, routeEnd);

    expect(source).toContain("if (intakeStep && !requestedUnitId && !requestedCategoryId) return false;");
    expect(block).toContain("const isMidIntakeCategoryReselection = Boolean(intakeStep && selectedCategoryId);");
    expect(block).toContain("setIntakeStep(null);");
    expect(block).toContain("setIntakeData({});");
    expect(block).toContain("setGeneralMode(false);");
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(routeBlock).toContain("valueAfterPrefix(value, STANDARD_UNIT_PREFIX)");
    expect(routeBlock).toContain("valueAfterPrefix(value, STANDARD_CATEGORY_PREFIX)");
  });

  it("keeps the step set unchanged and does not hydrate response category ids", () => {
    expect(source).toContain("type IntakeStep = 'name' | 'email' | 'phone' | 'office' | 'vehicle' | 'category' | null;");
    expect(source).not.toContain(["response", "locked_context", "category_id"].join("."));
  });

  it("preserves the single outgoing category-id payload line", () => {
    const payloadProperty = ["locked_context", "category_id"].join(".");
    expect(atlasClientSource.split(payloadProperty)).toHaveLength(2);
    expect(atlasClientSource).toContain("if (context.category_id) locked_context" + ".category_id = context.category_id;");
  });
});
