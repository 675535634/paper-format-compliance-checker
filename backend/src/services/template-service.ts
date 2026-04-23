import { defaultRuleConfig, seedTemplates, SYSTEM_USER_ID } from '../constants/defaults.js';
import { updateDatabase, readDatabase } from '../storage/database.js';
import type {
  PaperRuleConfig,
  PublicTemplateListResult,
  PublicTemplateSummary,
  RuleTemplate,
  TemplateVisibility,
} from '../types/index.js';
import { createId } from './id-service.js';
import type {
  CreateTemplateInput,
  ListPublicTemplatesInput,
  UpdateTemplateInput,
  UpdateTemplateVisibilityInput,
} from './validation-service.js';

const now = () => new Date().toISOString();

const mergeRuleConfig = (config?: Partial<PaperRuleConfig>): PaperRuleConfig => ({
  ...defaultRuleConfig,
  ...(config ?? {}),
});

const computeHotScore = (template: Pick<RuleTemplate, 'favoriteCount' | 'viewCount' | 'useCount'>): number =>
  template.favoriteCount * 5 + template.useCount * 3 + template.viewCount;

const hydrateTemplate = (template: RuleTemplate): RuleTemplate => ({
  ...template,
  config: mergeRuleConfig(template.config),
  hotScore: computeHotScore(template),
});

const sortByUpdatedAt = <T extends { updatedAt: string }>(items: T[]): T[] =>
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

const normalizeDefaultFlagsForOwner = (templates: RuleTemplate[], ownerId: string, defaultTemplateId?: string): RuleTemplate[] => {
  let matched = false;

  return templates.map((template) => {
    if (template.ownerId !== ownerId) {
      return template;
    }

    const isDefault = defaultTemplateId ? template.id === defaultTemplateId : !matched;
    matched = matched || isDefault;

    return {
      ...template,
      isDefault,
    };
  });
};

const canReadTemplate = (template: RuleTemplate, userId: string): boolean =>
  template.ownerId === userId || template.visibility === 'public';

const toPublicSummary = (
  template: RuleTemplate,
  ownerDisplayName: string,
  isFavorited: boolean
): PublicTemplateSummary => ({
  ...hydrateTemplate(template),
  ownerDisplayName,
  isFavorited,
});

export const createStarterTemplatesForUser = async (userId: string): Promise<void> => {
  await updateDatabase((state) => {
    if (state.templates.some((template) => template.ownerId === userId)) {
      return { state, result: undefined };
    }

    const startedAt = now();
    const starterTemplates = seedTemplates().map((template, index) => ({
      ...template,
      id: createId('tpl'),
      ownerId: userId,
      visibility: 'private' as TemplateVisibility,
      publishedAt: undefined,
      isDefault: index === 0,
      updatedAt: startedAt,
      favoriteCount: 0,
      viewCount: 0,
      useCount: 0,
      hotScore: 0,
    }));

    return {
      state: {
        ...state,
        templates: [...state.templates, ...starterTemplates],
      },
      result: undefined,
    };
  });
};

export const listTemplates = async (userId: string): Promise<RuleTemplate[]> => {
  const db = await readDatabase();
  return sortByUpdatedAt(
    db.templates
      .filter((template) => template.ownerId === userId)
      .map(hydrateTemplate)
  );
};

export const getTemplateById = async (id: string, userId: string): Promise<RuleTemplate | undefined> => {
  const db = await readDatabase();
  const template = db.templates.find((item) => item.id === id && item.ownerId === userId);
  return template ? hydrateTemplate(template) : undefined;
};

export const getDefaultTemplate = async (userId: string): Promise<RuleTemplate | undefined> => {
  const db = await readDatabase();
  const ownedTemplates = db.templates.filter((item) => item.ownerId === userId);
  const template = ownedTemplates.find((item) => item.isDefault) ?? ownedTemplates[0];
  return template ? hydrateTemplate(template) : undefined;
};

export const createTemplate = async (userId: string, input: CreateTemplateInput): Promise<RuleTemplate> =>
  updateDatabase((state) => {
    const ownedTemplates = state.templates.filter((template) => template.ownerId === userId);
    const shouldBeDefault = input.isDefault ?? ownedTemplates.length === 0;
    const timestamp = now();
    const template: RuleTemplate = {
      id: createId('tpl'),
      ownerId: userId,
      name: input.name,
      description: input.description,
      config: mergeRuleConfig(input.config),
      updatedAt: timestamp,
      isDefault: shouldBeDefault,
      visibility: input.visibility ?? 'private',
      publishedAt: input.visibility === 'public' ? timestamp : undefined,
      favoriteCount: 0,
      viewCount: 0,
      useCount: 0,
      hotScore: 0,
    };

    const templates = shouldBeDefault
      ? normalizeDefaultFlagsForOwner([...state.templates, template], userId, template.id)
      : [...state.templates, template];

    return {
      state: { ...state, templates },
      result: hydrateTemplate(template),
    };
  });

export const updateTemplate = async (
  id: string,
  userId: string,
  input: UpdateTemplateInput
): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const existing = state.templates.find((template) => template.id === id && template.ownerId === userId);
    if (!existing) {
      return { state, result: undefined };
    }

    const nextVisibility = input.visibility ?? existing.visibility;
    const nextTemplate: RuleTemplate = {
      ...existing,
      ...input,
      config: input.config ? mergeRuleConfig(input.config) : mergeRuleConfig(existing.config),
      isDefault: input.isDefault ?? existing.isDefault,
      visibility: nextVisibility,
      publishedAt: nextVisibility === 'public'
        ? existing.publishedAt ?? now()
        : undefined,
      updatedAt: now(),
    };

    const templates = state.templates.map((template) => template.id === id ? nextTemplate : template);
    const normalizedTemplates = nextTemplate.isDefault
      ? normalizeDefaultFlagsForOwner(templates, userId, id)
      : templates;

    const hydrated = normalizedTemplates.find((template) => template.id === id);
    return {
      state: { ...state, templates: normalizedTemplates },
      result: hydrated ? hydrateTemplate(hydrated) : undefined,
    };
  });

export const deleteTemplate = async (id: string, userId: string): Promise<boolean> =>
  updateDatabase((state) => {
    const target = state.templates.find((template) => template.id === id && template.ownerId === userId);
    if (!target) {
      return { state, result: false };
    }

    const remaining = state.templates.filter((template) => template.id !== id);
    const ownedRemaining = remaining.filter((template) => template.ownerId === userId);
    const normalized = target.isDefault && ownedRemaining.length > 0
      ? normalizeDefaultFlagsForOwner(remaining, userId, ownedRemaining[0].id)
      : remaining;

    return {
      state: {
        ...state,
        templates: normalized,
        templateFavorites: state.templateFavorites.filter((favorite) => favorite.templateId !== id),
      },
      result: true,
    };
  });

export const copyTemplate = async (id: string, userId: string): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const template = state.templates.find((item) => item.id === id && canReadTemplate(item, userId));
    if (!template) {
      return { state, result: undefined };
    }

    const copy: RuleTemplate = {
      ...hydrateTemplate(template),
      id: createId('tpl'),
      ownerId: userId,
      name: `${template.name} (Copy)`,
      visibility: 'private',
      publishedAt: undefined,
      isDefault: false,
      updatedAt: now(),
      favoriteCount: 0,
      viewCount: 0,
      useCount: 0,
      hotScore: 0,
    };

    const templates = state.templates.map((item) =>
      item.id === template.id
        ? {
            ...item,
            useCount: item.useCount + 1,
            hotScore: computeHotScore({
              favoriteCount: item.favoriteCount,
              useCount: item.useCount + 1,
              viewCount: item.viewCount,
            }),
          }
        : item
    );

    return {
      state: { ...state, templates: [...templates, copy] },
      result: hydrateTemplate(copy),
    };
  });

export const applyTemplateAsDefault = async (id: string, userId: string): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const target = state.templates.find((template) => template.id === id && template.ownerId === userId);
    if (!target) {
      return { state, result: undefined };
    }

    const templates = normalizeDefaultFlagsForOwner(
      state.templates.map((template) => ({
        ...template,
        updatedAt: template.id === id ? now() : template.updatedAt,
      })),
      userId,
      id
    );

    const result = templates.find((template) => template.id === id);
    return {
      state: { ...state, templates },
      result: result ? hydrateTemplate(result) : undefined,
    };
  });

export const updateTemplateVisibility = async (
  id: string,
  userId: string,
  input: UpdateTemplateVisibilityInput
): Promise<RuleTemplate | undefined> =>
  updateDatabase((state) => {
    const target = state.templates.find((template) => template.id === id && template.ownerId === userId);
    if (!target) {
      return { state, result: undefined };
    }

    const updated: RuleTemplate = {
      ...target,
      visibility: input.visibility,
      publishedAt: input.visibility === 'public' ? target.publishedAt ?? now() : undefined,
      updatedAt: now(),
    };

    const templates = state.templates.map((template) => template.id === id ? updated : template);
    return {
      state: { ...state, templates },
      result: hydrateTemplate(updated),
    };
  });

export const listPublicTemplates = async (
  input: ListPublicTemplatesInput,
  viewerId?: string
): Promise<PublicTemplateListResult> => {
  const db = await readDatabase();
  const query = input.query.trim().toLowerCase();
  const favorites = new Set(
    db.templateFavorites
      .filter((favorite) => favorite.userId === viewerId)
      .map((favorite) => favorite.templateId)
  );
  const usersById = new Map(db.users.map((user) => [user.id, user.displayName]));

  const filtered = db.templates
    .filter((template) => template.visibility === 'public' && template.ownerId !== '')
    .filter((template) => {
      if (!query) {
        return true;
      }

      const haystack = `${template.name} ${template.description}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((template) => toPublicSummary(
      template,
      usersById.get(template.ownerId) ?? (template.ownerId === SYSTEM_USER_ID ? 'System' : 'Unknown'),
      favorites.has(template.id)
    ));

  const sorted = [...filtered].sort((left, right) => {
    switch (input.sort) {
      case 'latest':
        return right.updatedAt.localeCompare(left.updatedAt);
      case 'favorites':
        return right.favoriteCount - left.favoriteCount || right.updatedAt.localeCompare(left.updatedAt);
      case 'uses':
        return right.useCount - left.useCount || right.updatedAt.localeCompare(left.updatedAt);
      case 'hottest':
      default:
        return right.hotScore - left.hotScore || right.updatedAt.localeCompare(left.updatedAt);
    }
  });

  const start = (input.page - 1) * input.pageSize;
  return {
    items: sorted.slice(start, start + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    total: sorted.length,
  };
};

export const getPublicTemplateById = async (
  id: string,
  viewerId?: string
): Promise<PublicTemplateSummary | undefined> =>
  updateDatabase((state) => {
    const template = state.templates.find((item) => item.id === id && item.visibility === 'public');
    if (!template) {
      return { state, result: undefined };
    }

    const updatedTemplate: RuleTemplate = {
      ...template,
      viewCount: template.viewCount + 1,
      hotScore: computeHotScore({
        favoriteCount: template.favoriteCount,
        useCount: template.useCount,
        viewCount: template.viewCount + 1,
      }),
    };

    const templates = state.templates.map((item) => item.id === id ? updatedTemplate : item);
    const owner = state.users.find((user) => user.id === updatedTemplate.ownerId);
    const isFavorited = state.templateFavorites.some((favorite) =>
      favorite.userId === viewerId && favorite.templateId === id
    );

    return {
      state: { ...state, templates },
      result: toPublicSummary(
        updatedTemplate,
        owner?.displayName ?? (updatedTemplate.ownerId === SYSTEM_USER_ID ? 'System' : 'Unknown'),
        isFavorited
      ),
    };
  });

export const favoritePublicTemplate = async (id: string, userId: string): Promise<PublicTemplateSummary | undefined> =>
  updateDatabase((state) => {
    const template = state.templates.find((item) => item.id === id && item.visibility === 'public');
    if (!template) {
      return { state, result: undefined };
    }

    const existingFavorite = state.templateFavorites.find((favorite) => favorite.userId === userId && favorite.templateId === id);
    const nextFavorites = existingFavorite
      ? state.templateFavorites
      : [
          ...state.templateFavorites,
          {
            id: createId('favorite'),
            userId,
            templateId: id,
            createdAt: now(),
          },
        ];

    const nextFavoriteCount = existingFavorite ? template.favoriteCount : template.favoriteCount + 1;
    const updatedTemplate: RuleTemplate = {
      ...template,
      favoriteCount: nextFavoriteCount,
      hotScore: computeHotScore({
        favoriteCount: nextFavoriteCount,
        useCount: template.useCount,
        viewCount: template.viewCount,
      }),
    };

    const templates = state.templates.map((item) => item.id === id ? updatedTemplate : item);
    const owner = state.users.find((user) => user.id === updatedTemplate.ownerId);

    return {
      state: { ...state, templates, templateFavorites: nextFavorites },
      result: toPublicSummary(
        updatedTemplate,
        owner?.displayName ?? (updatedTemplate.ownerId === SYSTEM_USER_ID ? 'System' : 'Unknown'),
        true
      ),
    };
  });

export const unfavoritePublicTemplate = async (id: string, userId: string): Promise<PublicTemplateSummary | undefined> =>
  updateDatabase((state) => {
    const template = state.templates.find((item) => item.id === id && item.visibility === 'public');
    if (!template) {
      return { state, result: undefined };
    }

    const hadFavorite = state.templateFavorites.some((favorite) => favorite.userId === userId && favorite.templateId === id);
    const nextFavorites = state.templateFavorites.filter((favorite) => !(favorite.userId === userId && favorite.templateId === id));
    const nextFavoriteCount = hadFavorite ? Math.max(0, template.favoriteCount - 1) : template.favoriteCount;
    const updatedTemplate: RuleTemplate = {
      ...template,
      favoriteCount: nextFavoriteCount,
      hotScore: computeHotScore({
        favoriteCount: nextFavoriteCount,
        useCount: template.useCount,
        viewCount: template.viewCount,
      }),
    };

    const templates = state.templates.map((item) => item.id === id ? updatedTemplate : item);
    const owner = state.users.find((user) => user.id === updatedTemplate.ownerId);

    return {
      state: { ...state, templates, templateFavorites: nextFavorites },
      result: toPublicSummary(
        updatedTemplate,
        owner?.displayName ?? (updatedTemplate.ownerId === SYSTEM_USER_ID ? 'System' : 'Unknown'),
        false
      ),
    };
  });

export const resolveRuleConfig = async (
  userId: string,
  templateId?: string,
  inlineRuleConfig?: PaperRuleConfig
): Promise<{
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
    const defaultTemplate = await getDefaultTemplate(userId);
    if (!defaultTemplate) {
      throw new Error('No template is available for the current user.');
    }

    return {
      templateId: defaultTemplate.id,
      config: mergeRuleConfig(defaultTemplate.config),
    };
  }

  const db = await readDatabase();
  const template = db.templates.find((item) => item.id === templateId && item.ownerId === userId);
  if (!template) {
    throw new Error(`Template ${templateId} was not found for the current user.`);
  }

  return {
    templateId: template.id,
    config: mergeRuleConfig(template.config),
  };
};
