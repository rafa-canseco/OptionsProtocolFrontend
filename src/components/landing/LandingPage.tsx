"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react";
import styles from "./LandingPage.module.css";

type LandingTheme = "light" | "dark";
type LandingLocale = "en" | "es";

const THEME_STORAGE_KEY = "b1nary-landing-theme";
const marketTickers = ["TSLA", "NVDA", "AAPL", "BTC", "ETH", "XAU", "SPX", "AMZN", "GOOGL", "META", "MSFT", "NFLX"];

const contentByLocale = {
  en: {
    nav: ["Strategies", "How it works", "Clarity"],
    openApp: "Open app",
    viewStrategies: "View strategies",
    mobileDescription: "Automated strategies, explained clearly.",
    heroEyebrow: "Automated investing",
    heroTitle: <>Your investments,<br /><em>running on autopilot.</em></>,
    heroDefinition: "An automated investing platform that turns advanced strategies into simple products. Your investment plan shouldn’t end after you buy.",
    explore: "Explore strategies",
    howItWorks: "How it works",
    marketLabel: "Illustrative markets",
    marketExamples: ["Global companies", "Gold", "Global indexes"],
    marketNote: "Examples only. Availability may vary.",
    strategiesHeading: ["Choose your approach", "The market matters. So does how you invest in it.", "Each strategy packages a clear objective, a defined process, and the outcomes you should understand before investing."],
    possibleOutcome: "Possible outcome",
    principalRisk: "Principal risk",
    understandProcess: "Understand the process",
    strategies: [
      { number: "01", eyebrow: "Buy with intention", title: "Strategic Entry", description: "Seek income while waiting for a familiar asset to reach a lower entry level you are comfortable with.", outcome: "Stay in dollars or enter at the defined level.", risk: "The asset can keep falling after the strategy enters.", icon: Target },
      { number: "02", eyebrow: "Put a position to work", title: "Income Strategy", description: "Seek additional income from an existing position while accepting a clear level where it may be sold.", outcome: "Keep the position or sell at the defined level.", risk: "You may miss gains above the chosen sale level.", icon: CircleDollarSign },
      { number: "03", eyebrow: "Keep the process moving", title: "Automatic Cycle", description: "A planned strategy that may move between a strategic entry and an income position as each stage completes.", outcome: "It may move between dollars and the selected market over time.", risk: "It can remain invested during a decline or exit before a larger rise.", availability: "Coming soon", icon: RefreshCw },
    ],
    how: ["How it works", "Choose the idea. Understand the plan.", "You should not need a trading desk to understand your investment. Every step is organized around a decision you already know how to make."],
    steps: [
      { number: "01", title: "Choose a market", text: "Start with one of the markets currently available and review the example before continuing." },
      { number: "02", title: "Choose your goal", text: "Decide whether you want a strategic entry, additional income, or an automatic cycle." },
      { number: "03", title: "Follow the progress", text: "See your balance, current stage, possible outcomes, and next step in one place." },
    ],
    clarity: ["Clarity before action", "Know what you are choosing.", "A simple interface should never hide a meaningful tradeoff. Review the process, timing, costs, and principal risk before you invest."],
    clarityItems: [["Plain-language risk", "See the main downside without decoding financial terminology."], ["Visible outcomes", "Understand what happens when the market moves in either direction."], ["Current status", "Follow where your money is and what stage comes next."]],
    review: ["Illustrative review", "Example amount", "Strategy", "Current stage", "Example preview", "Next availability", "Shown before confirmation", "Costs", "Review and continue"],
    faqHeading: ["Common questions", "Understand before you invest.", "The essential answers should be easy to find and easier to understand."],
    faqs: [
      { question: "How are these strategies different from buying an asset?", answer: "Buying an asset mainly depends on its price rising. A b1nary strategy follows predefined entry or sale levels and seeks income while it moves through each cycle." },
      { question: "Are returns guaranteed?", answer: "No. Every strategy carries market risk and results can vary. Before investing, you should be able to review the possible outcomes, costs, timing, and principal risk in plain language." },
      { question: "Can a strategy buy or sell an asset automatically?", answer: "Yes. Depending on the strategy and market movement, a predefined entry or sale may happen automatically. The relevant level and outcome should be visible before you confirm." },
      { question: "When can I access my money?", answer: "Your money may remain committed until the current strategy stage closes. Exact timing is shown before you confirm, and a withdrawal requested during an active stage is processed according to that schedule." },
    ],
    final: ["A clearer way to begin", "Invest with a plan you can explain.", "Explore simple strategies designed around familiar markets and clearly defined outcomes."],
    footerRisk: "Investment products involve risk. Values can rise or fall.",
    footerLinks: ["Strategies", "Risk information", "FAQs"],
  },
  es: {
    nav: ["Estrategias", "Cómo funciona", "Claridad"],
    openApp: "Abrir app",
    viewStrategies: "Ver estrategias",
    mobileDescription: "Estrategias automatizadas, explicadas con claridad.",
    heroEyebrow: "Inversión automatizada",
    heroTitle: <>Tus inversiones,<br /><em>en piloto automático.</em></>,
    heroDefinition: "Una plataforma de inversión automatizada que convierte estrategias avanzadas en productos simples. Tu plan de inversión no debería terminar después de comprar.",
    explore: "Explorar estrategias",
    howItWorks: "Cómo funciona",
    marketLabel: "Mercados ilustrativos",
    marketExamples: ["Empresas globales", "Oro", "Índices globales"],
    marketNote: "Solo ejemplos. La disponibilidad puede variar.",
    strategiesHeading: ["Elige tu enfoque", "El mercado importa. También cómo inviertes en él.", "Cada estrategia reúne un objetivo claro, un proceso definido y los posibles resultados que debes entender antes de invertir."],
    possibleOutcome: "Posible resultado",
    principalRisk: "Riesgo principal",
    understandProcess: "Entender el proceso",
    strategies: [
      { number: "01", eyebrow: "Compra con intención", title: "Entrada Estratégica", description: "Busca generar ingresos mientras esperas que un activo conocido alcance un nivel de entrada más bajo con el que te sientas cómodo.", outcome: "Permanecer en dólares o entrar al nivel definido.", risk: "El activo puede seguir bajando después de que la estrategia entre.", icon: Target },
      { number: "02", eyebrow: "Pon una posición a trabajar", title: "Estrategia de Ingresos", description: "Busca ingresos adicionales sobre una posición existente mientras aceptas un nivel claro en el que podría venderse.", outcome: "Conservar la posición o vender al nivel definido.", risk: "Puedes perder ganancias por encima del nivel de venta elegido.", icon: CircleDollarSign },
      { number: "03", eyebrow: "Mantén el proceso en movimiento", title: "Ciclo Automático", description: "Una estrategia planeada que puede alternar entre una entrada estratégica y una posición de ingresos conforme termina cada etapa.", outcome: "Puede alternar entre dólares y el mercado seleccionado con el tiempo.", risk: "Puede permanecer invertida durante una caída o salir antes de una subida mayor.", availability: "Próximamente", icon: RefreshCw },
    ],
    how: ["Cómo funciona", "Elige la idea. Entiende el plan.", "No necesitas una mesa de operaciones para entender tu inversión. Cada paso se organiza alrededor de una decisión que ya sabes tomar."],
    steps: [
      { number: "01", title: "Elige un mercado", text: "Empieza con uno de los mercados disponibles y revisa el ejemplo antes de continuar." },
      { number: "02", title: "Elige tu objetivo", text: "Decide si buscas una entrada estratégica, ingresos adicionales o un ciclo automático." },
      { number: "03", title: "Sigue el progreso", text: "Consulta tu balance, etapa actual, posibles resultados y siguiente paso en un solo lugar." },
    ],
    clarity: ["Claridad antes de actuar", "Entiende lo que estás eligiendo.", "Una interfaz simple nunca debe ocultar una decisión importante. Revisa el proceso, los tiempos, los costos y el riesgo principal antes de invertir."],
    clarityItems: [["Riesgo en lenguaje claro", "Conoce la principal desventaja sin descifrar terminología financiera."], ["Resultados visibles", "Entiende qué puede ocurrir cuando el mercado se mueve en cualquier dirección."], ["Estado actual", "Sigue dónde está tu dinero y qué etapa viene después."]],
    review: ["Revisión ilustrativa", "Monto de ejemplo", "Estrategia", "Etapa actual", "Vista previa de ejemplo", "Próxima disponibilidad", "Visible antes de confirmar", "Costos", "Revisar y continuar"],
    faqHeading: ["Preguntas frecuentes", "Entiende antes de invertir.", "Las respuestas esenciales deben ser fáciles de encontrar y aún más fáciles de entender."],
    faqs: [
      { question: "¿Cómo se diferencian estas estrategias de comprar un activo?", answer: "Comprar un activo depende principalmente de que su precio suba. Una estrategia sigue niveles predefinidos de entrada o venta y busca ingresos mientras avanza por cada ciclo." },
      { question: "¿Los rendimientos están garantizados?", answer: "No. Cada estrategia implica riesgo de mercado y los resultados pueden variar. Antes de invertir podrás revisar los posibles resultados, costos, tiempos y riesgo principal en lenguaje claro." },
      { question: "¿Una estrategia puede comprar o vender automáticamente?", answer: "Sí. Dependiendo de la estrategia y del movimiento del mercado, una entrada o venta predefinida puede ocurrir automáticamente. El nivel y el posible resultado estarán visibles antes de confirmar." },
      { question: "¿Cuándo puedo acceder a mi dinero?", answer: "Tu dinero puede permanecer comprometido hasta que cierre la etapa actual. El tiempo exacto se muestra antes de confirmar y cualquier retiro solicitado durante una etapa activa se procesa conforme a ese calendario." },
    ],
    final: ["Una forma más clara de comenzar", "Invierte con un plan que puedas explicar.", "Explora estrategias simples diseñadas alrededor de mercados conocidos y resultados claramente definidos."],
    footerRisk: "Los productos de inversión implican riesgos. Su valor puede subir o bajar.",
    footerLinks: ["Estrategias", "Información de riesgos", "Preguntas"],
  },
} as const;

export function LandingPage({ initialLocale = "en" }: { initialLocale?: LandingLocale }) {
  const [theme, setTheme] = useState<LandingTheme>("light");
  const [locale, setLocale] = useState<LandingLocale>(initialLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const copy = contentByLocale[locale];

  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.dataset.landingTheme = stored;
    }
  }, [initialLocale]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      document.documentElement.dataset.landingTheme = next;
      return next;
    });
  }

  function toggleLocale() {
    const next = locale === "en" ? "es" : "en";
    setLocale(next);
    document.cookie = `b1nary-locale=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={styles.landing} data-theme={theme} lang={locale}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark} aria-label="b1nary home">
            b<span>1</span>nary
          </Link>

          <nav className={styles.desktopNav} aria-label={locale === "es" ? "Navegación principal" : "Main navigation"}>
            <a href="#strategies">{copy.nav[0]}</a>
            <a href="#how-it-works">{copy.nav[1]}</a>
            <a href="#clarity">{copy.nav[2]}</a>
          </nav>

          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.themeButton}
              onClick={toggleTheme}
              aria-label={locale === "es"
                ? `Cambiar al modo ${theme === "light" ? "oscuro" : "claro"}`
                : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={styles.localeButton}
              onClick={toggleLocale}
              aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}
            >
              {locale === "en" ? "ES" : "EN"}
            </Button>
            <Button asChild variant="link" className={styles.signInLink}>
              <Link href="/vaults">{copy.openApp}</Link>
            </Button>
            <Button asChild size="lg" className={styles.headerCta}>
              <Link href="/vaults">
                {copy.viewStrategies} <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.menuButton}
                  aria-label={locale === "es" ? "Abrir navegación" : "Open navigation"}
                >
                  <span />
                  <span />
                </Button>
              </SheetTrigger>
              <SheetContent
                className={`${styles.mobileSheet} ${theme === "dark" ? styles.mobileSheetDark : ""}`}
              >
                <SheetHeader className={styles.mobileSheetHeader}>
                  <SheetTitle className={styles.mobileSheetTitle}>b1nary</SheetTitle>
                  <SheetDescription className={styles.mobileSheetDescription}>
                    {copy.mobileDescription}
                  </SheetDescription>
                </SheetHeader>
                <nav className={styles.mobileSheetNav} aria-label={locale === "es" ? "Navegación móvil" : "Mobile navigation"}>
                  <SheetClose asChild><a href="#strategies">{copy.nav[0]}</a></SheetClose>
                  <SheetClose asChild><a href="#how-it-works">{copy.nav[1]}</a></SheetClose>
                  <SheetClose asChild><a href="#clarity">{copy.nav[2]}</a></SheetClose>
                </nav>
                <div className={styles.mobileSheetFooter}>
                  <SheetClose asChild>
                    <Button asChild size="lg" className={styles.mobileSheetCta}>
                      <Link href="/vaults">{copy.viewStrategies} <ArrowRight aria-hidden="true" /></Link>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

      </header>

      <main>
        <HalftoneHero theme={theme} locale={locale} />

        <section className={styles.tickerStrip} aria-label={copy.marketLabel}>
          <p className={styles.tickerNote}>{copy.marketNote}</p>
          <div className={styles.tickerViewport}>
            <div className={styles.tickerTrack}>
              <div className={styles.tickerGroup}>
                {marketTickers.map((ticker) => <span key={ticker}>{ticker}<i>✦</i></span>)}
              </div>
              <div className={styles.tickerGroup} aria-hidden="true">
                {marketTickers.map((ticker) => <span key={ticker}>{ticker}<i>✦</i></span>)}
              </div>
            </div>
          </div>
        </section>

        <WaysSection locale={locale} />

        <section id="strategies" className={styles.strategiesSection}>
          <SectionHeading
            label={copy.strategiesHeading[0]}
            title={copy.strategiesHeading[1]}
            text={copy.strategiesHeading[2]}
          />

          <div className={styles.strategyGrid}>
            {copy.strategies.map((strategy) => {
              const Icon = strategy.icon;
              return (
                <article className={styles.strategyCard} key={strategy.title}>
                  <div className={styles.strategyTopline}>
                    <span>{strategy.number}</span>
                    {"availability" in strategy ? (
                      <span className={styles.availabilityBadge}>{strategy.availability}</span>
                    ) : (
                      <Icon aria-hidden="true" />
                    )}
                  </div>
                  <p className={styles.cardEyebrow}>{strategy.eyebrow}</p>
                  <h3>{strategy.title}</h3>
                  <p className={styles.cardDescription}>{strategy.description}</p>
                  <dl className={styles.outcomes}>
                    <div>
                      <dt>{copy.possibleOutcome}</dt>
                      <dd>{strategy.outcome}</dd>
                    </div>
                    <div>
                      <dt>{copy.principalRisk}</dt>
                      <dd>{strategy.risk}</dd>
                    </div>
                  </dl>
                  <a href="#how-it-works">
                    {copy.understandProcess} <ChevronRight aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className={styles.howSection}>
          <div className={styles.howIntro}>
            <p className={styles.eyebrow}>{copy.how[0]}</p>
            <h2>{copy.how[1]}</h2>
            <p>{copy.how[2]}</p>
          </div>
          <ol className={styles.stepsList}>
            {copy.steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="clarity" className={styles.claritySection}>
          <div className={styles.clarityVisual} aria-hidden="true">
            <div className={styles.clarityWindow}>
              <div className={styles.clarityWindowHeader}>
                <span />
                <p>{copy.review[0]}</p>
                <Eye />
              </div>
              <div className={styles.reviewAmount}>
                <small>{copy.review[1]}</small>
                <strong>$1,000.00</strong>
                <span>USD</span>
              </div>
              <div className={styles.reviewRows}>
                <p><span>{copy.review[2]}</span><strong>{copy.strategies[0].title}</strong></p>
                <p><span>{copy.review[3]}</span><strong>{copy.review[4]}</strong></p>
                <p><span>{copy.review[5]}</span><strong>{copy.review[6]}</strong></p>
                <p><span>{copy.review[7]}</span><strong>{copy.review[6]}</strong></p>
              </div>
              <div className={styles.reviewMockButton}>{copy.review[8]}</div>
            </div>
          </div>

          <div className={styles.clarityCopy}>
            <p className={styles.eyebrow}>{copy.clarity[0]}</p>
            <h2>{copy.clarity[1]}</h2>
            <p className={styles.clarityLead}>{copy.clarity[2]}</p>
            <ul>
              <li><ShieldCheck aria-hidden="true" /><span><strong>{copy.clarityItems[0][0]}</strong>{copy.clarityItems[0][1]}</span></li>
              <li><TrendingUp aria-hidden="true" /><span><strong>{copy.clarityItems[1][0]}</strong>{copy.clarityItems[1][1]}</span></li>
              <li><Eye aria-hidden="true" /><span><strong>{copy.clarityItems[2][0]}</strong>{copy.clarityItems[2][1]}</span></li>
            </ul>
          </div>
        </section>

        <section id="faq" className={styles.faqSection}>
          <SectionHeading
            label={copy.faqHeading[0]}
            title={copy.faqHeading[1]}
            text={copy.faqHeading[2]}
          />
          <div className={styles.faqList}>
            {copy.faqs.map((faq) => (
              <Collapsible className={styles.faqItem} key={faq.question}>
                <CollapsibleTrigger asChild>
                  <button type="button" className={styles.faqTrigger}>
                    {faq.question}<span aria-hidden="true">+</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className={styles.faqContent}>
                  <p>{faq.answer}</p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <p className={styles.eyebrow}>{copy.final[0]}</p>
            <h2>{copy.final[1]}</h2>
            <p>{copy.final[2]}</p>
          </div>
          <Button asChild size="lg" className={styles.primaryButton}>
            <Link href="/vaults">{copy.viewStrategies} <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.wordmark}>b<span>1</span>nary</Link>
        <p>{copy.footerRisk}</p>
        <div>
          <a href="#strategies">{copy.footerLinks[0]}</a>
          <a href="#clarity">{copy.footerLinks[1]}</a>
          <a href="#faq">{copy.footerLinks[2]}</a>
          <span>© {new Date().getFullYear()} b1nary</span>
        </div>
      </footer>
    </div>
  );
}

function WaysSection({ locale }: { locale: LandingLocale }) {
  const text = locale === "es"
    ? {
        label: "Cómo funciona el ciclo",
        title: "Elige una estrategia. El resto sucede automáticamente.",
        lead: "Agrega dinero o transfiere un activo. La estrategia ejecuta cada etapa, con los ingresos y posibles resultados claros desde el inicio.",
        stages: ["Elige y agrega fondos", "La estrategia hace el resto"],
        outcome: "Ingresos y resultados claros",
      }
    : {
        label: "How the cycle works",
        title: "Choose a strategy. The rest happens automatically.",
        lead: "Add money or transfer an asset. The strategy runs every stage, with income terms and possible outcomes clear from the start.",
        stages: ["Choose and add funds", "The strategy does the rest"],
        outcome: "Clear income and outcomes",
      };

  return (
    <section className={styles.waysSection}>
      <div className={styles.waysHeading}>
        <p className={styles.eyebrow}>{text.label}</p>
        <h2>{text.title}</h2>
        <p className={styles.waysLead}>{text.lead}</p>
      </div>
      <VaultCycleFlow stages={text.stages} outcome={text.outcome} />
    </section>
  );
}

function NumberPopIn({ value, delay = 0 }: { value: string; delay?: number }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setPlaying(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, []);

  return (
    <span className={`${styles.digitGroup} ${playing ? styles.digitGroupAnimating : ""}`}>
      {value.split("").map((character, index) => (
        <span className={styles.digit} key={`${character}-${index}`} style={{ animationDelay: `${delay + index * 70}ms` }}>{character}</span>
      ))}
    </span>
  );
}

function VaultCycleFlow({ stages, outcome }: { stages: readonly string[]; outcome: string }) {
  return (
    <div className={styles.vaultCycleFlow}>
      <div className={styles.vaultCycleSteps}>
        <div className={styles.vaultCycleStep}>
          <div className={styles.assetChoiceGlyph} aria-hidden="true">
            <span><Banknote /></span>
            <span>
              <svg viewBox="0 0 24 24" role="img" aria-label="Apple">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
            </span>
          </div>
          <NumberPopIn value="01" /><strong>{stages[0]}</strong>
        </div>
        <div className={styles.vaultFlowArrow}><i /><ArrowRight aria-hidden="true" /></div>
        <div className={`${styles.vaultCycleStep} ${styles.vaultCubeStep}`}>
          <ParticleCube />
          <NumberPopIn value="02" delay={500} /><strong>{stages[1]}</strong>
          <span className={styles.outcomeNote}><Check aria-hidden="true" />{outcome}</span>
        </div>
      </div>
    </div>
  );
}

function ParticleCube() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const points: Array<{ x: number; y: number; z: number }> = [];
    const divisions = 10;
    for (let face = 0; face < 6; face++) {
      for (let row = 0; row <= divisions; row++) {
        for (let column = 0; column <= divisions; column++) {
          const a = -1 + (column / divisions) * 2;
          const b = -1 + (row / divisions) * 2;
          if (face === 0) points.push({ x: 1, y: a, z: b });
          if (face === 1) points.push({ x: -1, y: a, z: b });
          if (face === 2) points.push({ x: a, y: 1, z: b });
          if (face === 3) points.push({ x: a, y: -1, z: b });
          if (face === 4) points.push({ x: a, y: b, z: 1 });
          if (face === 5) points.push({ x: a, y: b, z: -1 });
        }
      }
    }
    let frame = 0;
    let startedAt: number | null = null;
    let completedMove = 0;
    let inViewport = true;
    let dragging = false;
    let previousPointer = { x: 0, y: 0 };
    const dragRotation = { x: 0, y: 0 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const moves = [
      { axis: "y" as const, side: 1, direction: 1 },
      { axis: "x" as const, side: 1, direction: -1 },
      { axis: "z" as const, side: 1, direction: 1 },
      { axis: "y" as const, side: -1, direction: -1 },
    ];

    const rotatePoint = (point: { x: number; y: number; z: number }, axis: "x" | "y" | "z", angle: number) => {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      if (axis === "x") return { x: point.x, y: point.y * cosine - point.z * sine, z: point.y * sine + point.z * cosine };
      if (axis === "y") return { x: point.x * cosine - point.z * sine, y: point.y, z: point.x * sine + point.z * cosine };
      return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine, z: point.z };
    };
    const belongsToLayer = (point: { x: number; y: number; z: number }, move: (typeof moves)[number]) => point[move.axis] * move.side > 0.32;
    const commitMove = (moveIndex: number) => {
      const move = moves[moveIndex % moves.length];
      points.forEach((point, index) => {
        if (belongsToLayer(point, move)) points[index] = rotatePoint(point, move.axis, move.direction * Math.PI / 2);
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      previousPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      dragRotation.y += (event.clientX - previousPointer.x) * 0.008;
      dragRotation.x += (event.clientY - previousPointer.y) * 0.008;
      previousPointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const draw = (time: number) => {
      frame = 0;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const color = getComputedStyle(canvas).getPropertyValue("--landing-ink").trim() || "#11130f";
      if (startedAt === null) startedAt = time;
      const elapsed = reduceMotion ? 0 : time - startedAt;
      const moveDuration = 2300;
      const moveIndex = Math.floor(elapsed / moveDuration);
      while (completedMove < moveIndex) {
        commitMove(completedMove);
        completedMove++;
      }
      const move = moves[moveIndex % moves.length];
      const rawProgress = (elapsed % moveDuration) / moveDuration;
      const normalized = Math.max(0, Math.min(1, (rawProgress - 0.18) / 0.58));
      const eased = 1 - Math.pow(1 - normalized, 3) + Math.sin(normalized * Math.PI) * 0.05;
      const layerAngle = move.direction * eased * Math.PI / 2;
      const rotationY = 0.55 + elapsed * 0.000055 + dragRotation.y;
      const rotationX = -0.35 + Math.sin(elapsed * 0.00018) * 0.08 + dragRotation.x;
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const scale = Math.min(rect.width, rect.height) * 0.25;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      points.forEach((point) => {
        const animatedPoint = !reduceMotion && belongsToLayer(point, move) ? rotatePoint(point, move.axis, layerAngle) : point;
        const rotatedX = animatedPoint.x * cosY - animatedPoint.z * sinY;
        const rotatedZ = animatedPoint.x * sinY + animatedPoint.z * cosY;
        const y = animatedPoint.y * cosX - rotatedZ * sinX;
        const z = animatedPoint.y * sinX + rotatedZ * cosX;
        const perspective = 3.4 / (3.4 - z);
        const screenX = centerX + rotatedX * scale * perspective;
        const screenY = centerY + y * scale * perspective;
        context.globalAlpha = 0.25 + ((z + 1) / 2) * 0.75;
        context.fillStyle = color;
        context.beginPath();
        context.arc(screenX, screenY, 0.7 + ((z + 1) / 2) * 1.25, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      if (!reduceMotion && inViewport && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const resume = () => {
      if (reduceMotion || !inViewport || document.hidden || frame) return;
      startedAt = null;
      completedMove = 0;
      frame = window.requestAnimationFrame(draw);
    };
    const pause = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibilityChange = () => document.hidden ? pause() : resume();
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) resume();
      else pause();
    });

    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (reduceMotion) draw(0);
    else resume();
    return () => {
      pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particleCube} aria-hidden="true" />;
}

function HalftoneHero({ theme, locale }: { theme: LandingTheme; locale: LandingLocale }) {
  const copy = contentByLocale[locale];

  return (
    <section className={styles.halftoneHero}>
      <HalftoneCanvas theme={theme} />
      <div className={styles.halftoneOverlay}>
        <div className={styles.halftoneContent}>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroDefinition}</p>
        </div>
      </div>
    </section>
  );
}

function HalftoneCanvas({ theme }: { theme: LandingTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let inViewport = true;
    let lastDraw = -Infinity;

    const draw = (time: number) => {
      frame = 0;
      if (!reduceMotion && time - lastDraw < 32) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      lastDraw = time;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const background = theme === "dark" ? "#0d0f0c" : "#f4f3ed";
      const ink = theme === "dark" ? "#8f978b" : "#74786f";
      context.fillStyle = background;
      context.fillRect(0, 0, rect.width, rect.height);
      context.fillStyle = ink;

      const spacing = 11;
      const t = reduceMotion ? 0 : time * 0.00032;
      const aspect = rect.width / Math.max(rect.height, 1);
      for (let y = spacing / 2; y < rect.height; y += spacing) {
        for (let x = spacing / 2; x < rect.width; x += spacing) {
          const nx = (x / rect.width - 0.5) * aspect;
          const ny = y / rect.height - 0.5;
          const wave = (
            Math.sin(nx * 8 + t * 2.1) +
            Math.sin(ny * 10 - t * 1.7) +
            Math.sin((nx + ny) * 7 + t)
          ) / 6 + 0.5;
          const edge = Math.min(1, Math.hypot(nx / Math.max(aspect * 0.5, 0.1), ny / 0.5));
          const calm = Math.min(1, Math.hypot(nx / Math.max(aspect * 0.42, 0.1), ny / 0.34));
          const radius = 0.45 + Math.max(0, Math.min(1, wave + edge * 0.2)) * 3.1;
          context.globalAlpha = (0.12 + edge * 0.55) * (0.3 + calm * 0.7);
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      if (!reduceMotion && inViewport && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const resume = () => {
      if (reduceMotion || !inViewport || document.hidden || frame) return;
      lastDraw = -Infinity;
      frame = window.requestAnimationFrame(draw);
    };
    const pause = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibilityChange = () => document.hidden ? pause() : resume();
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) resume();
      else pause();
    });

    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    draw(0);
    return () => {
      pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className={styles.halftoneCanvas} aria-hidden="true" />;
}

function SectionHeading({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>{label}</p>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
