"use client";

import Link from "next/link";
import { BlossomCarousel, BlossomDot, BlossomDots, BlossomNext, BlossomPrev } from "@blossom-carousel/react";
import { useEffect, useRef, useState } from "react";
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
  Bot,
  ChevronLeft,
  Check,
  ChevronRight,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAppPreferences } from "@/lib/preferences";
import styles from "./LandingPage.module.css";

type LandingTheme = "light" | "dark";
type LandingLocale = "en" | "es";

const illustrativeBuyIncome = ["+$18", "+$24", "+$31"] as const;
const illustrativeSellIncome = ["+$12", "+$20", "+$27"] as const;
const contentByLocale = {
  en: {
    nav: ["Strategies", "How it works", "FAQs"],
    openApp: "Open app",
    viewStrategies: "View strategies",
    mobileDescription: "Automated strategies, explained clearly.",
    heroEyebrow: "Automated investing",
    heroTitle: <>Your investments,<br /><em>running on autopilot.</em></>,
    heroDefinition: "An automated investing platform that turns advanced strategies into simple products. Your investment plan shouldn’t end after you buy.",
    explore: "Explore strategies",
    howItWorks: "How it works",
    strategiesHeading: ["Choose how you want to invest.", "Start with money or an asset. Then choose a strategic entry, income strategy, or automatic cycle."],
    startsWith: "Starts with",
    possibleOutcome: "Possible outcome",
    understandProcess: "Understand the process",
    strategies: [
      { input: "Money", eyebrow: "Buy lower", title: "Strategic Entry", description: "Set a lower buy price and get paid while you wait.", outcome: "Keep your money or buy at the defined price." },
      { input: "Asset", eyebrow: "Sell higher", title: "Income Strategy", description: "Set a higher sale price for an asset you own and get paid while you wait.", outcome: "Keep the asset or sell at the defined price." },
      { input: "Money", eyebrow: "Buy. Sell. Repeat.", title: "Automatic Cycle", description: "Combines both stages and moves forward when a stage results in a purchase or sale.", outcome: "Move between money and the asset automatically." },
    ],
    how: ["Where the payment comes from", "It works like price insurance.", "The strategy makes a simple promise: buy if the price falls to the defined level, or sell if it rises. Specialized market participants pay for that protection."],
    paymentFlow: ["Price protection", "Example payment to the strategy"],
    steps: [
      { number: "01", title: "Define the promise", text: "Choose the asset, price, and how long the commitment lasts." },
      { number: "02", title: "Receive a payment", text: "A professional market participant pays the strategy when the stage begins." },
      { number: "03", title: "Complete or repeat", text: "At the end of the stage, the strategy completes any resulting purchase or sale. If neither happens, it can begin the same stage again. Either way, the payment is yours to keep." },
    ],
    agentReady: ["Agent ready", "Built for you. Ready for your agent.", "Let an AI assistant follow progress, compare strategies, and prepare actions. You stay in control."],
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
    nav: ["Estrategias", "Cómo funciona", "Preguntas"],
    openApp: "Abrir app",
    viewStrategies: "Ver estrategias",
    mobileDescription: "Estrategias automatizadas, explicadas con claridad.",
    heroEyebrow: "Inversión automatizada",
    heroTitle: <>Tus inversiones,<br /><em>en piloto automático.</em></>,
    heroDefinition: "Una plataforma de inversión automatizada que convierte estrategias avanzadas en productos simples. Tu plan de inversión no debería terminar después de comprar.",
    explore: "Explorar estrategias",
    howItWorks: "Cómo funciona",
    strategiesHeading: ["Elige cómo quieres invertir.", "Comienza con dinero o con un activo. Después elige una entrada estratégica, una estrategia de ingresos o el ciclo automático."],
    startsWith: "Comienza con",
    possibleOutcome: "Posible resultado",
    understandProcess: "Entender el proceso",
    strategies: [
      { input: "Dinero", eyebrow: "Compra más abajo", title: "Entrada Estratégica", description: "Define un precio de compra más bajo y recibe un pago mientras esperas.", outcome: "Conservar tu dinero o comprar al precio definido." },
      { input: "Activo", eyebrow: "Vende más arriba", title: "Estrategia de Ingresos", description: "Define un precio de venta más alto para un activo que ya tienes y recibe un pago mientras esperas.", outcome: "Conservar el activo o vender al precio definido." },
      { input: "Dinero", eyebrow: "Compra. Vende. Repite.", title: "Ciclo Automático", description: "Combina ambas etapas y avanza cuando una etapa termina en una compra o venta.", outcome: "Alternar automáticamente entre dinero y el activo." },
    ],
    how: ["De dónde viene el pago", "Funciona como un seguro de precio.", "La estrategia hace una promesa sencilla: comprar si el precio baja al nivel definido o vender si sube. Empresas especializadas pagan por esa protección."],
    paymentFlow: ["Protección de precio", "Pago de ejemplo a la estrategia"],
    steps: [
      { number: "01", title: "Define la promesa", text: "Elige el activo, el precio y cuánto tiempo dura el compromiso." },
      { number: "02", title: "Recibe un pago", text: "Un participante profesional paga a la estrategia cuando comienza la etapa." },
      { number: "03", title: "Cumple o repite", text: "Al terminar la etapa, la estrategia completa cualquier compra o venta resultante. Si ninguna ocurre, puede iniciar nuevamente la misma etapa. En cualquier caso, el pago es tuyo." },
    ],
    agentReady: ["Listo para agentes", "Diseñado para ti. Listo para tu agente.", "Permite que un asistente de IA siga el progreso, compare estrategias y prepare acciones. Tú mantienes el control."],
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
  const { theme, locale, setTheme, setLocale } = useAppPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const copy = contentByLocale[locale];

  useEffect(() => {
    if (locale !== initialLocale) setLocale(initialLocale);
    // The server-provided locale is only an initialization hint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  function toggleLocale() {
    setLocale(locale === "en" ? "es" : "en");
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
            <a href="#faq">{copy.nav[2]}</a>
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
            <Button asChild size="lg" className={styles.headerCta}>
              <Link href="/vaults">
                {copy.openApp} <ArrowRight aria-hidden="true" />
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
                  <SheetClose asChild><a href="#faq">{copy.nav[2]}</a></SheetClose>
                </nav>
                <div className={styles.mobileSheetFooter}>
                  <SheetClose asChild>
                    <Button asChild size="lg" className={styles.mobileSheetCta}>
                      <Link href="/vaults">{copy.openApp} <ArrowRight aria-hidden="true" /></Link>
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

        <WaysSection locale={locale} />
        <CycleStagesSection locale={locale} />

        <section id="strategies" className={styles.strategiesSection}>
          <div className={styles.strategySectionHeading}>
            <h2>{copy.strategiesHeading[0]}</h2>
            <p>{copy.strategiesHeading[1]}</p>
          </div>

          <div className={styles.strategyCarouselShell} aria-roledescription="carousel" aria-label={copy.strategiesHeading[0]}>
            <BlossomCarousel id="strategy-carousel" as="ul" className={styles.strategyCarousel}>
              {copy.strategies.map((strategy, index) => {
                return (
                  <li className={styles.strategySlide} data-blossom-slide key={strategy.title}>
                    <article className={styles.strategyCard}>
                      <div className={styles.strategyCardVisual}>
                        {index === 0 ? (
                          <div className={styles.strategyParticleSphere}><ParticleSphere /></div>
                        ) : index === 1 ? (
                          <StrategyParticleVisual shape="pyramid" />
                        ) : (
                          <StrategyParticleVisual shape="cycle" />
                        )}
                        <span>{copy.startsWith} <strong>{strategy.input}</strong></span>
                      </div>
                      <div className={styles.strategyCardContent}>
                        <p className={styles.cardEyebrow}>{strategy.eyebrow}</p>
                        <h3>{strategy.title}</h3>
                        <p className={styles.cardDescription}>{strategy.description}</p>
                        <dl className={styles.outcomes}>
                          <div>
                            <dt>{copy.possibleOutcome}</dt>
                            <dd>{strategy.outcome}</dd>
                          </div>
                        </dl>
                        <a href="#how-it-works">
                          {copy.understandProcess} <ChevronRight aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  </li>
                );
              })}
            </BlossomCarousel>
            <div className={styles.strategyCarouselControls}>
              <BlossomPrev for="strategy-carousel" aria-label={locale === "es" ? "Estrategia anterior" : "Previous strategy"}>
                <ChevronLeft aria-hidden="true" />
              </BlossomPrev>
              <BlossomDots for="strategy-carousel" aria-label={locale === "es" ? "Elegir estrategia" : "Choose strategy"}>
                {({ index, active }) => (
                  <BlossomDot
                    className={styles.strategyDot}
                    data-active={active}
                    aria-label={locale === "es" ? `Mostrar ${copy.strategies[index].title}` : `Show ${copy.strategies[index].title}`}
                  ><span /></BlossomDot>
                )}
              </BlossomDots>
              <BlossomNext for="strategy-carousel" aria-label={locale === "es" ? "Siguiente estrategia" : "Next strategy"}>
                <ChevronRight aria-hidden="true" />
              </BlossomNext>
            </div>
          </div>

        </section>

        <section id="how-it-works" className={styles.howSection}>
          <div className={styles.howIntro}>
            <p className={styles.eyebrow}>{copy.how[0]}</p>
            <h2>{copy.how[1]}</h2>
            <p className={styles.howLead}>{copy.how[2]}</p>
            <div className={styles.paymentOriginVisual} aria-hidden="true">
              <div className={styles.paymentPromise}>
                <ShieldCheck />
                <span>{copy.paymentFlow[0]}</span>
              </div>
              <div className={styles.paymentTransfer}>
                <i /><i /><i />
                <ArrowRight />
              </div>
              <div className={styles.paymentFigure}>
                <small>{copy.paymentFlow[1]}</small>
                <NumberPopIn value="+$48" delay={250} />
              </div>
            </div>
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

        <section className={styles.agentReadySection}>
          <div className={styles.agentReadyVisual} aria-hidden="true">
            <span className={styles.agentOrbit}><i /><i /><i /></span>
            <span className={styles.agentCore}><Bot /></span>
          </div>
          <div className={styles.agentReadyCopy}>
            <p className={styles.eyebrow}>{copy.agentReady[0]}</p>
            <h2>{copy.agentReady[1]}</h2>
            <p>{copy.agentReady[2]}</p>
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
          <a href="#faq">{copy.footerLinks[1]}</a>
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

function CycleStagesSection({ locale }: { locale: LandingLocale }) {
  const text = locale === "es"
    ? {
        label: "Ciclo Automático",
        title: "Define una compra más baja. Define una venta más alta.",
        lead: "Recibe un pago en cada etapa. Al terminar, si compra o vende, avanza. Si no, repite.",
        money: "Dinero",
        buy: "Compra debajo del precio actual",
        income: "Ingreso de ejemplo",
        bought: "Si compra · avanza",
        asset: "Activo",
        sell: "Venta arriba del precio actual",
        sold: "Si vende · reinicia",
        buyRepeat: "Si no compra · repite",
        sellRepeat: "Si no vende · repite",
        floor: "Nunca programa una venta debajo del precio de compra",
        restart: "Vuelve a dinero y comienza otra vez",
        oneSide: "También puedes usar solo la etapa de compra o solo la de venta.",
      }
    : {
        label: "Automatic Cycle",
        title: "Set a lower buy price. Set a higher sell price.",
        lead: "Get paid at each step. At the end, move forward if it buys or sells. Otherwise, repeat.",
        money: "Money",
        buy: "Buy below the current price",
        income: "Example income",
        bought: "If it buys · move forward",
        asset: "Asset",
        sell: "Sell above the current price",
        sold: "If it sells · restart",
        buyRepeat: "If it does not buy · repeat",
        sellRepeat: "If it does not sell · repeat",
        floor: "Never schedules a sale below the purchase price",
        restart: "Return to money and start again",
        oneSide: "You can also use only the buy stage or only the sell stage.",
      };

  return (
    <section id="automatic-cycle" className={styles.cycleStagesSection}>
      <div className={styles.cycleStagesHeading}>
        <p className={styles.eyebrow}>{text.label}</p>
        <h2>{text.title}</h2>
        <p>{text.lead}</p>
      </div>

      <div className={styles.wheelRoad}>
        <div className={styles.roadNode}>
          <div className={styles.roadParticle}><ParticleSphere /><strong>{text.money}</strong></div>
        </div>
        <div className={styles.roadArrow}><ArrowRight aria-hidden="true" /></div>
        <div className={`${styles.roadNode} ${styles.roadDecision}`}>
          <CycleIncomeCounter label={text.income} values={illustrativeBuyIncome} />
          <Target aria-hidden="true" />
          <strong>{text.buy}</strong>
          <span><RefreshCw aria-hidden="true" />{text.buyRepeat}</span>
        </div>
        <div className={styles.roadArrow}><span>{text.bought}</span><ArrowRight aria-hidden="true" /></div>
        <div className={styles.roadNode}>
          <div className={styles.roadParticle}><ParticleCube /><strong>{text.asset}</strong></div>
        </div>
        <div className={styles.roadArrow}><ArrowRight aria-hidden="true" /></div>
        <div className={`${styles.roadNode} ${styles.roadDecision}`}>
          <CycleIncomeCounter label={text.income} values={illustrativeSellIncome} />
          <TrendingUp aria-hidden="true" />
          <strong>{text.sell}</strong>
          <span><RefreshCw aria-hidden="true" />{text.sellRepeat}</span>
          <small>{text.floor}</small>
        </div>

        <svg className={styles.roadReturn} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="road-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <path d="M930 8 C930 98 760 104 500 104 C240 104 70 98 70 8" markerEnd="url(#road-arrow)" />
          <circle className={styles.roadTraveler} r="4" />
        </svg>
        <span className={styles.roadSold}>{text.sold}</span>
        <span className={styles.roadRestart}>{text.restart}</span>
      </div>
      <p className={styles.oneSideNote}>{text.oneSide}</p>
    </section>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function CycleIncomeCounter({ label, values }: { label: string; values: readonly string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let interval = 0;
    const timeout = window.setTimeout(() => {
      setIndex((current) => (current + 1) % values.length);
      interval = window.setInterval(() => setIndex((current) => (current + 1) % values.length), 6000);
    }, 6000);
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, [values.length]);

  const value = values[index];
  return (
    <div className={styles.cycleIncomeCounter} aria-label={label}>
      <small>{label}</small>
      <NumberPopIn key={value} value={value} />
    </div>
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
            <span><AppleMark /></span>
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

function StrategyParticleVisual({ shape }: { shape: "pyramid" | "cycle" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const points: Array<{ x: number; y: number; z: number; group: number }> = [];
    if (shape === "pyramid") {
      const top = { x: 0, y: -0.92, z: 0 };
      const bottom = { x: 0, y: 0.92, z: 0 };
      const rim = [
        { x: 0.78, y: 0, z: 0 },
        { x: 0, y: 0, z: 0.78 },
        { x: -0.78, y: 0, z: 0 },
        { x: 0, y: 0, z: -0.78 },
      ];
      const faces = rim.flatMap((point, index) => {
        const next = rim[(index + 1) % rim.length];
        return [[top, point, next], [bottom, next, point]];
      });
      faces.forEach((face, group) => {
        for (let row = 0; row <= 11; row++) {
          for (let column = 0; column <= 11 - row; column++) {
            const a = row / 11;
            const b = column / 11;
            const c = 1 - a - b;
            points.push({
              x: face[0].x * a + face[1].x * b + face[2].x * c,
              y: face[0].y * a + face[1].y * b + face[2].y * c,
              z: face[0].z * a + face[1].z * b + face[2].z * c,
              group,
            });
          }
        }
      });
    } else {
      const major = 0.62;
      const minor = 0.22;
      for (let ring = 0; ring < 36; ring++) {
        const u = (ring / 36) * Math.PI * 2;
        for (let side = 0; side < 14; side++) {
          const v = (side / 14) * Math.PI * 2;
          points.push({
            x: (major + minor * Math.cos(v)) * Math.cos(u),
            y: minor * Math.sin(v),
            z: (major + minor * Math.cos(v)) * Math.sin(u),
            group: ring,
          });
        }
      }
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let inViewport = true;

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
      const styles = getComputedStyle(canvas);
      const ink = styles.getPropertyValue("--landing-ink").trim() || "#11130f";
      const accent = styles.getPropertyValue("--landing-accent").trim() || "#3157ff";
      const scale = Math.min(rect.width, rect.height) * (shape === "pyramid" ? 0.39 : 0.42);
      const rotation = reduceMotion ? 0.42 : time * 0.00018;
      const cosine = Math.cos(rotation);
      const sine = Math.sin(rotation);

      points.forEach((point, index) => {
        let x = point.x;
        let y = point.y;
        let z = point.z;
        const rotatedX = x * cosine - z * sine;
        z = x * sine + z * cosine;
        x = rotatedX;
        const tilt = shape === "cycle" ? 0.58 : 0.34;
        const rotatedY = y * Math.cos(tilt) - z * Math.sin(tilt);
        z = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = rotatedY;
        const perspective = 2.7 / (2.7 - z);
        context.globalAlpha = 0.2 + ((z + 1) / 2) * 0.8;
        context.fillStyle = index % 19 === 0 ? accent : ink;
        context.beginPath();
        context.arc(rect.width / 2 + x * scale * perspective, rect.height / 2 + y * scale * perspective, 0.8 + Math.max(0, z) * 0.6, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      if (!reduceMotion && inViewport && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const resume = () => {
      if (reduceMotion || !inViewport || document.hidden || frame) return;
      frame = window.requestAnimationFrame(draw);
    };
    const pause = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) resume();
      else pause();
    });
    const onVisibilityChange = () => document.hidden ? pause() : resume();

    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (reduceMotion) draw(0);
    else resume();
    return () => {
      pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [shape]);

  return <canvas ref={canvasRef} className={styles.strategyParticleObject} aria-hidden="true" />;
}

function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const points = Array.from({ length: 420 }, (_, index) => {
      const y = 1 - ((index + 0.5) / 420) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * index;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
    });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let inViewport = true;

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
      const angle = reduceMotion ? 0.55 : time * 0.00012;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const scale = Math.min(rect.width, rect.height) * 0.38;

      points.forEach((point) => {
        const x = point.x * cosine - point.z * sine;
        const z = point.x * sine + point.z * cosine;
        const perspective = 2.8 / (2.8 - z);
        context.globalAlpha = 0.18 + ((z + 1) / 2) * 0.82;
        context.fillStyle = color;
        context.beginPath();
        context.arc(
          rect.width / 2 + x * scale * perspective,
          rect.height / 2 + point.y * scale * perspective,
          0.7 + ((z + 1) / 2) * 1.15,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      context.globalAlpha = 1;
      if (!reduceMotion && inViewport && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const resume = () => {
      if (reduceMotion || !inViewport || document.hidden || frame) return;
      frame = window.requestAnimationFrame(draw);
    };
    const pause = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) resume();
      else pause();
    });
    const onVisibilityChange = () => document.hidden ? pause() : resume();

    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (reduceMotion) draw(0);
    else resume();
    return () => {
      pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particleSphere} aria-hidden="true" />;
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
