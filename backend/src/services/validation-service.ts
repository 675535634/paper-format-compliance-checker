import { z } from 'zod';

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
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).default(''),
  config: paperRuleConfigSchema,
  isDefault: z.boolean().optional().default(false),
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

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateCheckInput = z.infer<typeof createCheckSchema>;
