'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Check, ChevronUp, FlaskConical, MessageCircleQuestion } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useRef } from 'react';

import { BackedByKortex } from '@/components/brand/backed-by-kortex';
import { ExampleQuestions } from '@/components/landing/example-questions';
import { Logo } from '@/components/brand/logo';
import { useAuth } from '@/features/auth/auth-provider';
import { BTS_FILIERES } from '@/lib/community';

gsap.registerPlugin(ScrollTrigger);

const HEADLINE = ['Bloqué', 'sur', 'un', 'exercice', '?', 'Demandez', 'à', 'la', 'communauté.'];
const MUTED_FROM = 5;

const STEPS = [
  {
    n: '01',
    title: 'Posez votre question',
    text: 'Un titre clair, l’énoncé, votre filière et quelques tags. Ajoutez une photo de l’exercice si besoin.',
  },
  {
    n: '02',
    title: 'Recevez des explications',
    text: 'Des étudiants et des professeurs répondent avec la méthode, pas juste le résultat.',
  },
  {
    n: '03',
    title: 'Validez la meilleure',
    text: 'Votez pour les réponses utiles et marquez celle qui vous a débloqué. Elle aidera le suivant.',
  },
];

const FEATURES = [
  { title: 'Fil par filière', text: 'RIT, IDA, Télécoms, Gestion… filtrez par filière, matière ou mot-clé.' },
  { title: 'Votes & meilleure réponse', text: 'Les explications utiles remontent, la solution retenue est mise en avant.' },
  { title: 'Professeurs vérifiés', text: 'Les profs rejoignent la communauté et valident les réponses justes.' },
  { title: 'Bibliothèque BTS', text: 'Sujets d’examen, corrigés, cours et TD classés par filière, matière et session, avec leur source.' },
  { title: 'Recherche anti-doublons', text: 'Retrouvez la question déjà posée avant d’en ouvrir une nouvelle.' },
  { title: 'Modération', text: 'Signalement en un clic, contenus abusifs masqués, règles simples.' },
];

/**
 * Hero demo: one question per filière, each in its own subject, so a visitor
 * from any BTS sees right away that STOUDENT is not a RIT-only space.
 * The second answer is always the one validated by a teacher.
 */
const DEMOS = [
  {
    filiere: 'IDA',
    tags: ['python', 'boucles'],
    title: 'Pourquoi ma boucle for range(1, 10) s’arrête à 9 au lieu de 10 ?',
    author: 'kouadio.ida · BTS 1',
    answers: [
      { who: 'awa.ida', badge: '', text: 'La borne de fin de range() est exclue : il compte de 1 à 9.' },
      { who: 'Prof. Koné', badge: 'Prof', text: 'Exact. Écris range(1, 11) pour inclure 10.' },
    ],
  },
  {
    filiere: 'FCGE',
    tags: ['tva', 'facturation'],
    title: 'Comment retrouver la TVA d’une facture de 590 000 F TTC ?',
    author: 'marie.fc · BTS 2',
    answers: [
      { who: 'ibrahim.fc', badge: '', text: 'HT = 590 000 / 1,18 = 500 000 F, donc TVA = 90 000 F.' },
      { who: 'Prof. Diallo', badge: 'Prof', text: 'Bien. Taux normal de 18 %, vérifie les exonérations.' },
    ],
  },
  {
    filiere: 'RIT',
    tags: ['échantillonnage', 'shannon'],
    title: 'Pourquoi mon signal à 5 kHz apparaît à 1 kHz si j’échantillonne à 6 kHz ?',
    author: 'yao.rit · BTS 2',
    answers: [
      { who: 'fatou.rit', badge: '', text: 'Shannon : fe > 2·fmax, donc il faut fe > 10 kHz ici.' },
      { who: 'Prof. Bamba', badge: 'Prof', text: 'Oui : à 6 kHz, la raie à 5 kHz se replie à 1 kHz.' },
    ],
  },
];

const PRINCIPLES = [
  'L’entraide reste gratuite',
  'Ouvert à toutes les filières du BTS, pas seulement la RIT',
  'On explique le raisonnement, on ne donne pas juste la réponse',
  'On cite ses sources, on ne recopie pas',
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const authed = Boolean(user);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: bubbles float in, headline words rise, CTAs fade.
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro
          .from('.bubble', { scale: 0, opacity: 0, transformOrigin: 'center', duration: 0.8, stagger: 0.08, ease: 'back.out(1.7)' }, 0)
          .from('.hero-word', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.06 }, 0.1)
          .from('.hero-fade', { y: 24, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.6)
          .from('.thread', { y: 60, opacity: 0, rotateX: 12, duration: 1.1 }, 0.5);

        gsap.to('.bubble', {
          y: (i) => (i % 2 ? -14 : 14),
          duration: (i) => 3 + (i % 3),
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        // Hero thread: a looping Q&A that changes filière each round.
        const demo = gsap.timeline({ repeat: -1, delay: 1.6 });
        DEMOS.forEach((thread, t) => {
          const scope = `.demo-thread-${t}`;
          const votes = { v: 0 };
          demo
            .set('.demo-thread', { autoAlpha: 0 })
            .set(`${scope} .demo-answer`, { opacity: 0, x: 24 })
            .set(`${scope} .demo-typing`, { opacity: 0 })
            .set(`${scope} .demo-accepted`, { opacity: 0, scale: 0.6 })
            .set(`${scope} .demo-votes`, { textContent: 0 })
            .set(`${scope} .demo-count`, { textContent: '0 réponse' })
            .to(scope, { autoAlpha: 1, duration: 0.4 })
            .to(`${scope} .demo-typing`, { opacity: 1, duration: 0.3 })
            .to(`${scope} .demo-typing`, { opacity: 0, duration: 0.3, delay: 0.9 });
          thread.answers.forEach((_, i) => {
            demo
              .to(`${scope} .demo-answer-${i}`, { opacity: 1, x: 0, duration: 0.5, ease: 'back.out(1.6)' })
              .set(`${scope} .demo-count`, { textContent: `${i + 1} réponse${i ? 's' : ''}` }, '<');
          });
          demo
            .to(votes, {
              v: 8 + t * 3,
              duration: 1.1,
              ease: 'power2.out',
              onStart: () => {
                votes.v = 0;
              },
              onUpdate: () => {
                root.current?.querySelectorAll(`${scope} .demo-votes`).forEach((el) => {
                  el.textContent = String(Math.round(votes.v));
                });
              },
            })
            .to(`${scope} .demo-accepted`, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' })
            .to(scope, { autoAlpha: 0, duration: 0.4, delay: 2.2 });
        });

        gsap.to('.glow', { xPercent: 18, yPercent: -12, scale: 1.15, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut' });

        gsap.utils.toArray<HTMLElement>('.count').forEach((el) => {
          const end = Number(el.dataset.to || 0);
          const obj = { v: 0 };
          gsap.to(obj, {
            v: end,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            onUpdate: () => {
              el.textContent = String(Math.round(obj.v));
            },
          });
        });

        gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
          gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
        });

        gsap.from('.steps-line', {
          scaleX: 0,
          transformOrigin: 'left center',
          ease: 'none',
          scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: true },
        });
        gsap.from('.step', {
          y: 50,
          opacity: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.steps', start: 'top 75%' },
        });
        gsap.from('.feature', {
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: { each: 0.08, grid: 'auto', from: 'start' },
          ease: 'power3.out',
          scrollTrigger: { trigger: '.features', start: 'top 80%' },
        });
        gsap.from('.filiere-chip', {
          y: 20,
          opacity: 0,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.filieres', start: 'top 85%' },
        });
        gsap.from('.lab-wave path', {
          strokeDashoffset: 900,
          duration: 2,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: '.lab', start: 'top 75%' },
        });
        gsap.to('.cta-bubbles', {
          yPercent: -20,
          ease: 'none',
          scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      // Sticky nav gets a border once the page scrolls.
      ScrollTrigger.create({
        start: 40,
        onUpdate: (self) =>
          root.current?.querySelector('.nav')?.classList.toggle('nav-scrolled', self.scroll() > 40),
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="overflow-x-hidden bg-white text-ink-900">
      <style>{`.nav-scrolled{border-color:var(--color-ink-200);background:rgba(255,255,255,.88);backdrop-filter:blur(8px)}`}</style>

      {/* NAV */}
      <header className="nav fixed inset-x-0 top-0 z-50 border-b border-transparent transition-colors duration-300">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:gap-6 sm:px-8">
          <Link href="/" aria-label="STOUDENT" className="shrink-0">
            <Logo />
          </Link>
          <nav className="ml-6 hidden gap-6 text-sm text-ink-500 md:flex" aria-label="Sections">
            <a href="#exemples" className="hover:text-ink-900">Exemples</a>
            <a href="#fonctionnement" className="hover:text-ink-900">Fonctionnement</a>
            <a href="#fonctionnalites" className="hover:text-ink-900">Fonctionnalités</a>
            <a href="#lab" className="hover:text-ink-900">Le labo</a>
            <Link href="/questions" className="hover:text-ink-900">Les questions</Link>
            <Link href="/bibliotheque" className="hover:text-ink-900">Sujets & cours</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <Link href="/questions" className="btn-primary">
                Ouvrir le fil <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-ink-50 sm:inline-flex">
                  Connexion
                </Link>
                <Link href="/register" className="btn-primary whitespace-nowrap">
                  Rejoindre
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate pb-24 pt-32 sm:pt-40">
        <div className="glow pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-200 via-accent-50 to-transparent opacity-80 blur-3xl" />
        <Bubbles className="pointer-events-none absolute inset-x-0 top-16 -z-10 mx-auto h-[520px] w-full max-w-6xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <p className="hero-fade mb-5 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> L’entraide des étudiants de toutes les filières du BTS
            </p>
            <h1 className="font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.2rem]">
              {HEADLINE.map((w, i) => (
                <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                  <span className={`hero-word inline-block ${i >= MUTED_FROM ? 'text-ink-400' : ''}`}>
                    {w}&nbsp;
                  </span>
                </span>
              ))}
            </h1>
            <p className="hero-fade mt-6 max-w-xl text-lg text-ink-500">
              RIT, IDA, ELT, SEI, MSP, FCGE… STOUDENT réunit étudiants et
              professeurs de <b className="font-semibold text-ink-900">toutes les filières du BTS</b> pour
              poser des questions et partager des méthodes. Gratuitement.
            </p>
            <div className="hero-fade mt-8 flex flex-wrap items-center gap-3">
              <Link href={authed ? '/questions/ask' : '/register'} className="btn-primary px-6 py-3 text-base">
                {authed ? 'Poser une question' : 'Rejoindre gratuitement'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/questions" className="btn-outline px-6 py-3 text-base">
                Parcourir les questions
              </Link>
            </div>
            <p className="hero-fade mt-5 flex items-center gap-2 text-sm text-ink-500">
              <Check className="h-4 w-4 text-ink-900" /> Inscription avec votre numéro WhatsApp · 100 % gratuit
            </p>
            <BackedByKortex className="hero-fade mt-6" />
          </div>

          {/* Animated Q&A threads, one filière at a time */}
          <div className="thread min-w-0 [perspective:1200px]">
            <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-[0_30px_80px_-20px_rgba(24,24,27,.25)]">
              {/* Stacked in one grid cell: the box keeps the height of the tallest. */}
              <div className="grid">
                {DEMOS.map((thread, t) => (
                  <div
                    key={thread.filiere}
                    className={`demo-thread demo-thread-${t} [grid-area:1/1] ${t ? 'invisible' : ''}`}
                    aria-hidden={t > 0}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex shrink-0 flex-col items-center rounded-xl bg-ink-50 px-2.5 py-2 text-ink-900">
                        <ChevronUp className="h-4 w-4" aria-hidden />
                        <span className="demo-votes font-display text-lg font-semibold">{8 + t * 3}</span>
                        <span className="text-[10px] text-ink-400">votes</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded-md bg-ink-900 px-2 py-0.5 font-semibold text-white">{thread.filiere}</span>
                          {thread.tags.map((tag) => (
                            <span key={tag} className="rounded-md bg-ink-50 px-2 py-0.5 text-ink-600">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 font-display text-base font-semibold leading-snug">{thread.title}</p>
                        <p className="mt-1 text-xs text-ink-400">
                          {thread.author} · <span className="demo-count">2 réponses</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2.5">
                      <p className="demo-typing flex items-center gap-2 text-xs text-ink-400 opacity-0">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:.3s]" />
                        </span>
                        Quelqu’un rédige une réponse…
                      </p>
                      {thread.answers.map((a, i) => (
                        <div
                          key={a.who}
                          className={`demo-answer demo-answer-${i} relative rounded-xl border px-3.5 py-2.5 text-sm ${i === 1 ? 'border-ink-900 bg-ink-50' : 'border-ink-200'}`}
                        >
                          <p className="flex items-center gap-2 text-xs font-semibold">
                            {a.who}
                            {a.badge && (
                              <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                {a.badge}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-ink-700">{a.text}</p>
                          {i === 1 && (
                            <span className="demo-accepted absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-success text-white shadow">
                              <Check className="h-4 w-4" aria-label="Meilleure réponse" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[11px] text-ink-400">
                Démonstration animée · exemples illustratifs, une filière par question
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-ink-200 bg-accent-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-ink-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {[
            { to: 100, suffix: ' %', label: 'gratuit pour l’entraide, sans abonnement' },
            { to: BTS_FILIERES.length, suffix: '', label: 'filières du BTS, la liste officielle du MESRS' },
            { to: 5, suffix: '', label: 'TP de labo virtuel 3D inclus' },
          ].map((s) => (
            <div key={s.label} className="py-10 text-center sm:px-6">
              <p className="font-display text-5xl font-semibold">
                <span className="count" data-to={s.to}>
                  {s.to}
                </span>
                {s.suffix}
              </p>
              <p className="mt-2 text-sm text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <ExampleQuestions />

      {/* HOW IT WORKS */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">Fonctionnement</p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Débloqué en trois étapes.</h2>
        </div>
        <div className="steps relative mt-14">
          <div className="steps-line absolute left-0 right-0 top-7 hidden h-0.5 bg-accent-400 md:block" />
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="step relative">
                <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-ink-900 font-display text-lg font-semibold text-white ring-8 ring-white">
                  {s.n}
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-ink-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" className="scroll-mt-24 bg-ink-900 py-24 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="reveal max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/50">Fonctionnalités</p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
              Comme Stack Overflow, pensé pour les étudiants.
            </h2>
          </div>
          <div className="features mt-14 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature group bg-ink-900 p-7 transition-colors duration-300 hover:bg-white/[.04]">
                <span className="mb-5 block h-0.5 w-10 bg-white/40 transition-all duration-500 group-hover:w-20 group-hover:bg-white" />
                <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-white/60">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILIERES */}
      <section className="filieres mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">Pour qui ?</p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
            Toutes les filières du BTS. Pas seulement la RIT.
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            Chaque question porte sa filière et sa matière : un étudiant en compta trouve les réponses
            de compta, un développeur celles de programmation.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BTS_FILIERES.map((f) => (
            <Link
              key={f.code}
              href={`/questions?filiere=${encodeURIComponent(f.code)}`}
              className="filiere-chip group rounded-2xl border border-ink-200 p-4 transition hover:border-ink-900"
            >
              <span className="font-display text-lg font-semibold">{f.code}</span>
              <span className="mt-1 block text-sm text-ink-500 group-hover:text-ink-900">{f.name}</span>
            </Link>
          ))}
        </div>
        <p className="filiere-chip mt-4 text-sm text-ink-500">
          Votre filière n’y est pas ? Indiquez-la à l’inscription : elle rejoint la liste.
        </p>
      </section>

      {/* LAB */}
      <section id="lab" className="lab scroll-mt-24 border-t border-ink-200 bg-ink-50 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-8 lg:grid-cols-2">
          <div className="reveal min-w-0">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-ink-400">
              <FlaskConical className="h-4 w-4" aria-hidden /> Onglet Lab
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
              Et quand la théorie ne suffit pas : le labo.
            </h2>
            <p className="mt-5 text-lg text-ink-500">
              Un laboratoire virtuel 3D est inclus. Générateur, oscilloscope, analyseur de
              spectre : manipulez, mesurez, et revenez poser votre question avec la courbe sous les yeux.
            </p>
            <ul className="mt-6 space-y-3">
              {['Salle de TP en 3D, pilotée comme un jeu', '5 TP : Fourier, échantillonnage, filtrage…', 'Notés sur ce que vous manipulez, avec XP et badges'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-ink-900" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal min-w-0 rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
            <div className="scope-grid rounded-2xl bg-ink-900 p-4">
              <svg viewBox="0 0 400 160" className="lab-wave h-40 w-full" aria-hidden="true">
                <path
                  d="M0 80 Q25 10 50 80 T100 80 T150 80 T200 80 T250 80 T300 80 T350 80 T400 80"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="900"
                />
                <path
                  d="M0 80 L25 30 L50 30 L50 130 L100 130 L100 30 L150 30 L150 130 L200 130 L200 30 L250 30 L250 130 L300 130 L300 30 L350 30 L350 130 L400 130"
                  fill="none"
                  stroke="rgba(255,255,255,.3)"
                  strokeWidth="2"
                  strokeDasharray="900"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm text-ink-500">Signal carré et sa fondamentale, calculés par le moteur scientifique.</p>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <div className="reveal grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">La communauté</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">Quatre règles, pas plus.</h2>
            <Link href="/regles" className="mt-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
              Lire les règles <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p} className="rounded-2xl border border-ink-200 p-5">
                <span className="font-mono text-xs text-accent-600">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-1 font-medium">{p}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta relative isolate overflow-hidden bg-ink-900 py-28 text-white">
        <Bubbles className="cta-bubbles pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-10" />
        <div className="reveal mx-auto max-w-3xl px-4 text-center sm:px-8">
          <MessageCircleQuestion className="mx-auto h-10 w-10" aria-hidden />
          <h2 className="mt-4 font-display text-4xl font-semibold sm:text-6xl">Votre prochaine question a déjà une réponse.</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
            Créez votre compte avec votre numéro WhatsApp et rejoignez l’entraide.
          </p>
          <Link
            href={authed ? '/questions/ask' : '/register'}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink-900 transition hover:bg-ink-200"
          >
            {authed ? 'Poser une question' : 'Rejoindre STOUDENT'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-500 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <Logo />
            <BackedByKortex />
          </div>
          <nav className="flex gap-5" aria-label="Pied de page">
            <Link href="/regles" className="hover:text-ink-900">Règles de la communauté</Link>
            <Link href="/confidentialite" className="hover:text-ink-900">Confidentialité</Link>
            <Link href="/login" className="hover:text-ink-900">Connexion</Link>
          </nav>
          <p>© {new Date().getFullYear()} STOUDENT</p>
        </div>
      </footer>
    </div>
  );
}

/** Decorative speech bubbles floating behind the hero. */
function Bubbles({ className = '' }: { className?: string }) {
  // Kept to the edges, clear of the headline and the copy.
  const items = [
    { x: -2, y: 2, s: 64, c: 'bg-accent-300' },
    { x: 90, y: 6, s: 48, c: 'bg-ink-100' },
    { x: 96, y: 60, s: 72, c: 'bg-accent-200' },
    { x: 46, y: 0, s: 28, c: 'bg-accent-200' },
    { x: 52, y: 98, s: 36, c: 'bg-accent-300' },
  ];
  return (
    <div className={className} aria-hidden="true">
      {items.map((b, i) => (
        <span
          key={i}
          className={`bubble absolute rounded-2xl rounded-bl-sm ${b.c}`}
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s * 0.75 }}
        />
      ))}
    </div>
  );
}
