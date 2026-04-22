import { defaultRuleConfig } from '../constants/defaults.js';
import { updateDatabase, readDatabase } from '../storage/database.js';
import type { PaperRuleConfig, RuleTemplate } from '../types/index.js';
import { createId } from './id-service.js';
import type { CreateTemplateInput, UpdateTemplateInput } from './validation-service.js';

const now = () => new Date().toISOString();

const mergeRuleConfig = (config?: Partial<PaperRuleConfig>): PaperRuleConfig => ({
  ...defaultRuleConfig,
  ...(config ?? {}),
});

const hydrateTemplate = (template: RuleTemplate): RuleTemplate => ({
  ...template,
  config: mergeRuleConfig(template.config),
});

const normalizeTemplateFlags = (templates: RuleTemplate[], defaultTemplateId?: string): RuleTemplate[] =>
  templates.map((template) => ({
    ...template,
    isDefault: defaultTemplateId ? template.id === defaultTemplateId : template.isDefault,
  }));

export const listTemplates = async (): Promise<RuleTemplate[]> => {
  const db = await readDatabase();
  return [...db.templates]
    .map(hydrateTemplate)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

export const getTemplateById = async (id: string): Promise<RuleTemplate | undefined> => {
  const db = await readDatabase();
  const template = db.templates.find((item) => item.id === id);
  return template ? hydrateTemplate(template) : undefined;
};

export const getDefaultTemplate = async (): Promise<RuleTemplate> => {
  const db = await readDatabase();
  const template = db.templates.find((item) => item.isDefault) ?? db.templates[0];

  if (template) {
    return hydrateTemplate(template);
  }

  return {
    id: createId('tpl'),
    name: '默认模板',
    description: '系统自动生成的兜底模板。',
    config: defaultRuleConfig,
    updatedAt: now(),
    isDefault: true,
  };
};

export const createTemplate = async (input: CreateTemplateInput): Promise<RuleTemplate> =>
  updateDatabase((state) => {
    const template: RuleTemplate = {
      id: createId('tpl'),
      name: input.name,
      description: input.description,
      config: mergeRuleConfig(input.config),
      updatedAt: now(),
      isDefault: input.isDefault ?? false,
    };

    const templates = input.isDefault
      ? normalizeTemplateFlags([...state.templates, template], template.id)
      : [...state.templates, template];

    return {
      state: { ...state, templates },
      result: template,
    };
  });

export const updateTemplate = async (id: string, input: UpdateTemplateInput): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const existing = state.templates.find((template) => template.id === id);
    if (!existing) {
      return { state, result: undefined };
    }

    const nextTemplate: RuleTemplate = {
      ...existing,
      ...input,
      config: input.config ? mergeRuleConfig(input.config) : mergeRuleConfig(existing.config),
      isDefault: input.isDefault ?? existing.isDefault,
      updatedAt: now(),
    };

    const templates = state.templates.map((template) => template.id === id ? nextTemplate : template);
    const normalizedTemplates = nextTemplate.isDefault
      ? normalizeTemplateFlags(templates, id)
      : templates;

    return {
      state: { ...state, templates: normalizedTemplates },
      result: normalizedTemplates.find((template) => template.id === id),
    };
  });

export const deleteTemplate = async (id: string): Promise<boolean> =>
  updateDatabase((state) => {
    const target = state.templates.find((template) => template.id === id);
    if (!target) {
      return { state, result: false };
    }

    const remaining = state.templates.filter((template) => template.id !== id);
    const normalized = target.isDefault && remaining.length > 0
      ? normalizeTemplateFlags(
          remaining.map((template, index) => ({ ...template, isDefault: index === 0 })),
          remaining[0]?.id
        )
      : remaining;

    return {
      state: { ...state, templates: normalized },
      result: true,
    };
  });

export const copyTemplate = async (id: string): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const template = state.templates.find((item) => item.id === id);
    if (!template) {
      return { state, result: undefined };
    }

    const copy: RuleTemplate = {
      ...hydrateTemplate(template),
      id: createId('tpl'),
      name: `${template.name}（副本）`,
      isDefault: false,
      updatedAt: now(),
    };

    return {
      state: { ...state, templates: [...state.templates, copy] },
      result: copy,
    };
  });

export const applyTemplateAsDefault = async (id: string): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const target = state.templates.find((template) => template.id === id);
    if (!target) {
      return { state, result: undefined };
    }

    const templates = normalizeTemplateFlags(
      state.templates.map((template) => ({
        ...template,
        updatedAt: template.id === id ? now() : template.updatedAt,
      })),
      id
    );

    return {
      state: { ...state, templates },
      result: templates.find((template) => template.id === id),
    };
  });

export const resolveRuleConfig = async (templateId?: string, inlineRuleConfig?: PaperRuleConfig): Promise<{
  templateId: string;
  config: PaperRuleConfig;
}> => {
  if (inlineRuleConfig) {
    return {
      templateId: templateId ?? 'inline_rule_config',
      config: mergeRuleConfig(inlineRuleConfig),
    };
  }

  if (!templateId) {
    const defaultTemplate = await getDefaultTemplate();
    return {
      templateId: defaultTemplate.id,
      config: mergeRuleConfig(defaultTemplate.config),
    };
  }

  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} was not found.`);
  }

  return {
    templateId: template.id,
    config: mergeRuleConfig(template.config),
  };
};
