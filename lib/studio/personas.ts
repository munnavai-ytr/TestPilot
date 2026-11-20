import { generateJson, StudioGeminiHooks } from './gemini';
import {
  PERSONA_AGGREGATE_SCHEMA,
  PERSONA_FEEDBACK_SCHEMA,
  PERSONA_FEEDBACK_SYSTEM_PROMPT,
} from './prompts';
import { DEVICE_PRESETS } from './store';
import {
  PersonaAggregateSummary,
  PersonaDefinition,
  PersonaFeedbackResult,
  StudioStep,
} from './types';

export const STUDIO_PERSONAS: PersonaDefinition[] = [
  {
    id: 'new_user',
    name: 'New user',
    preferredDeviceId: 'laptop',
    defaultGoal: 'Explore the home screen, understand what the app does, and try the primary action.',
    rules:
      'You are visiting this app for the very first time with zero prior context. You read headings, buttons, and helper text literally. If a label is vague or lacks onboarding guidance, you notice the confusion immediately and report it.',
  },
  {
    id: 'impatient_user',
    name: 'Impatient user',
    preferredDeviceId: 'iphone_14',
    defaultGoal: 'Complete the main user flow as fast as possible without reading long instructions.',
    rules:
      'You skim everything, ignore paragraphs of instructions, tap primary buttons immediately, double-click slow controls, and hit Back or reload mid-flow if a screen feels slow or unresponsive.',
  },
  {
    id: 'careless_user',
    name: 'Careless data user',
    preferredDeviceId: 'laptop',
    defaultGoal: 'Test key forms by submitting blank, malformed, overly long, or unusual text inputs.',
    rules:
      'You submit forms before filling required fields, type invalid emails, enter 200+ characters or special symbols like quotes and accents, and check whether validation messages are clear, helpful, and prevent crashes.',
  },
  {
    id: 'keyboard_user',
    name: 'Keyboard-only user',
    preferredDeviceId: 'laptop',
    defaultGoal: 'Navigate primary menus, dialogs, and forms using only Tab, Enter, Space, and Escape.',
    rules:
      'You cannot use a mouse or touch screen. Prefer "press" actions (Tab, Shift+Tab, Enter, Space, Escape, ArrowDown/Up). Check whether focus moves logically, dialogs trap/close properly with Escape, and interactive controls respond to Enter/Space.',
  },
  {
    id: 'non_tech_user',
    name: 'Non-technical user',
    preferredDeviceId: 'iphone_14',
    defaultGoal: 'Try signing up or using the core feature without guessing technical terms.',
    rules:
      'You get confused by developer jargon, cryptic error codes, hidden menus, or unlabelled icons. When an action lacks clear confirmation or plain-language feedback, you hesitate or give up.',
  },
  {
    id: 'phone_thumb_user',
    name: 'Phone thumb user',
    preferredDeviceId: 'iphone_se',
    defaultGoal: 'Use the app comfortably with one thumb on a 375px screen.',
    rules:
      'You are browsing one-handed on a narrow 375x667 phone screen. Tiny buttons (<36px), tightly packed links, horizontal overflow, sticky bars covering buttons, and bottom-clipped modals frustrate you.',
  },
  {
    id: 'power_user',
    name: 'Power user',
    preferredDeviceId: 'desktop',
    defaultGoal: 'Test non-linear navigation, rapid switching, filters, and reloading mid-flow.',
    rules:
      'You skip tutorials, jump directly between sections, try features out of expected order, reload the page mid-way to verify state persistence, and check if back/forward navigation breaks anything.',
  },
  {
    id: 'skeptic_user',
    name: 'Skeptic',
    preferredDeviceId: 'laptop',
    defaultGoal: 'Probe edge cases, boundary inputs, empty states, and misleading promises.',
    rules:
      'You inspect error handling closely, test harmless boundary values (0, negative numbers, whitespace-only text), click disabled or subtle controls to verify guards, and check whether claims match actual behavior.',
  },
];

export function getPersonaById(id: string): PersonaDefinition | undefined {
  return STUDIO_PERSONAS.find((p) => p.id === id);
}

export function getDeviceDimensionsForPersona(persona: PersonaDefinition): {
  label: string;
  width: number;
  height: number;
} {
  const preset =
    DEVICE_PRESETS.find((d) => d.id === persona.preferredDeviceId) || DEVICE_PRESETS[5];
  return {
    label: preset.label,
    width: preset.width,
    height: preset.height,
  };
}

export async function evaluatePersonaFeedback(
  params: {
    persona: PersonaDefinition;
    deviceLabel: string;
    goal: string;
    steps: StudioStep[];
    stopReason: string;
    languageHint: string;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<PersonaFeedbackResult> {
  const compactSteps = params.steps.map((s) => ({
    step: s.index,
    url: s.url,
    action: s.actionSummary,
    result: s.resultStatus,
    detail: s.resultDetail,
    note: s.say,
    errors: [
      ...(s.evidenceDelta.consoleErrors || []),
      ...(s.evidenceDelta.pageErrors || []),
      ...(s.evidenceDelta.failedRequests || []),
    ].slice(0, 3),
  }));

  const raw = await generateJson<{
    taskResult: 'success' | 'partial' | 'failed';
    summary: string;
    frictionPoints: PersonaFeedbackResult['frictionPoints'];
    confusingMoments: string[];
    bugs: PersonaFeedbackResult['bugs'];
    suggestions: string[];
    rating: number;
    wouldReturn: boolean;
  }>(
    {
      system: PERSONA_FEEDBACK_SYSTEM_PROMPT,
      schema: PERSONA_FEEDBACK_SCHEMA,
      temperature: 0.35,
      signal: params.signal,
      userParts: [
        {
          text: JSON.stringify({
            persona: {
              name: params.persona.name,
              rules: params.persona.rules,
            },
            device: params.deviceLabel,
            goal: params.goal,
            outcomeReason: params.stopReason,
            preferredLanguage: params.languageHint || 'English',
            untrustedRunTrace: compactSteps,
          }),
        },
      ],
    },
    hooks
  );

  const clampedRating = Math.max(1, Math.min(5, Math.round(Number(raw.rating) || 3)));

  return {
    personaId: params.persona.id,
    personaName: params.persona.name,
    deviceLabel: params.deviceLabel,
    goal: params.goal,
    taskResult:
      raw.taskResult === 'success' || raw.taskResult === 'partial' || raw.taskResult === 'failed'
        ? raw.taskResult
        : 'partial',
    summary: raw.summary || 'Completed evaluation.',
    frictionPoints: Array.isArray(raw.frictionPoints) ? raw.frictionPoints : [],
    confusingMoments: Array.isArray(raw.confusingMoments) ? raw.confusingMoments : [],
    bugs: Array.isArray(raw.bugs) ? raw.bugs : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
    rating: clampedRating,
    wouldReturn: Boolean(raw.wouldReturn),
    stepsTaken: params.steps.length,
  };
}

export async function aggregatePersonaFeedback(
  params: {
    results: PersonaFeedbackResult[];
    languageHint: string;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<PersonaAggregateSummary> {
  const total = params.results.length;
  const avg =
    total > 0
      ? Number(
          (params.results.reduce((sum, r) => sum + (r.rating || 0), 0) / total).toFixed(2)
        )
      : 0;

  if (total === 0) {
    return { averageRating: 0, clusters: [], topThemes: [] };
  }

  const compact = params.results.map((r) => ({
    persona: r.personaName,
    taskResult: r.taskResult,
    rating: r.rating,
    wouldReturn: r.wouldReturn,
    frictionPoints: r.frictionPoints,
    confusingMoments: r.confusingMoments,
    suggestions: r.suggestions,
  }));

  const raw = await generateJson<{
    clusters: PersonaAggregateSummary['clusters'];
    topThemes: string[];
  }>(
    {
      system:
        'You synthesize usability findings across multiple virtual test users. Group recurring friction points into clear clusters with exact affected counts (out of totalPersonas) and extract up to 5 top themes. Reply in the requested language.',
      schema: PERSONA_AGGREGATE_SCHEMA,
      temperature: 0.25,
      signal: params.signal,
      userParts: [
        {
          text: JSON.stringify({
            totalPersonas: total,
            preferredLanguage: params.languageHint || 'English',
            personaFeedback: compact,
          }),
        },
      ],
    },
    hooks
  );

  return {
    averageRating: avg,
    clusters: (Array.isArray(raw.clusters) ? raw.clusters : []).map((c) => ({
      ...c,
      totalPersonas: total,
      affectedCount: Math.max(1, Math.min(total, Math.round(c.affectedCount || 1))),
    })),
    topThemes: (Array.isArray(raw.topThemes) ? raw.topThemes : []).slice(0, 5),
  };
}
