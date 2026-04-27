import { z } from 'zod';
import { fixOptionValues } from '../types/index.js';

export const paperRuleConfigSchema = z.object({
  pageSize: z.string().min(1),
  margin: z.string().min(1),
  headerRule: z.string().default(''),
  coverItems: z.string().default(''),
  requiredSections: z.string().default(''),
  bodyFont: z.string().min(1),
  bodyFontSize: z.string().min(1),
  lineHeight: z.union([z.string().min(1), z.number()]),
  paragraphSpacing: z.string().min(1),
  firstLineIndent: z.string().min(1),
  headingFormats: z.string().min(1),
  pageNumberRule: z.string().min(1),
  abstractFormat: z.string().min(1),
  keywordFormat: z.string().min(1),
  referenceFormat: z.string().min(1),
  figureCaptionRule: z.string().default(''),
  tableCaptionRule: z.string().default(''),
  tocRule: z.string().default(''),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).default(''),
  config: paperRuleConfigSchema,
  isDefault: z.boolean().optional().default(false),
  visibility: z.enum(['private', 'public']).optional().default('private'),
});

export const updateTemplateSchema = createTemplateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided when updating a template.' }
);

export const createCheckSchema = z.object({
  fileId: z.string().min(1),
  templateId: z.string().optional(),
  inlineRuleConfig: paperRuleConfigSchema.optional(),
}).refine(
  (value) => Boolean(value.templateId || value.inlineRuleConfig),
  { message: 'Either templateId or inlineRuleConfig is required.' }
);

export const fixDownloadSchema = z.object({
  fixOptions: z.array(z.enum(fixOptionValues)).min(1).optional(),
});

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.email(),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(64).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(128),
});

export const listPublicTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  query: z.string().trim().max(120).optional().default(''),
  sort: z.enum(['latest', 'hottest', 'favorites', 'uses']).optional().default('hottest'),
});

export const updateTemplateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'public']),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateCheckInput = z.infer<typeof createCheckSchema>;
export type FixDownloadInput = z.infer<typeof fixDownloadSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ListPublicTemplatesInput = z.infer<typeof listPublicTemplatesSchema>;
export type UpdateTemplateVisibilityInput = z.infer<typeof updateTemplateVisibilitySchema>;
