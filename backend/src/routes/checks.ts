import { Router, type Request } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import {
  createCheck,
  createFixedDocumentForCheck,
  createFixedDocumentForCheckWithOptions,
  getCheckById,
  getCheckDebugLog,
  getCheckResult,
  listChecks,
  retryCheck,
} from '../services/check-service.js';
import { createFixExportLogger } from '../services/fix-export-log-service.js';
import { createCheckSchema, fixDownloadSchema } from '../services/validation-service.js';

export const checksRouter = Router();

const toAsciiDownloadName = (filename: string): string => {
  const normalized = filename
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/["\\;]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 0 ? normalized : 'download.bin';
};

const buildAttachmentDisposition = (filename: string): string => {
  const asciiFilename = toAsciiDownloadName(filename);
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

const logFixDownloadRouteEvent = async (
  request: Request,
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> => {
  const logger = createFixExportLogger({
    userId: request.currentUser?.id,
    checkId: String(request.params.id ?? ''),
    requestId: request.requestId,
  });

  await logger(event, {
    routeMethod: request.method,
    routePath: request.originalUrl,
    ...details,
  });
};

checksRouter.get('/', async (request, response) => {
  response.json(await listChecks(request.currentUser!.id));
});

checksRouter.post('/', async (request, response) => {
  const payload = createCheckSchema.parse(request.body);
  const check = await createCheck(request.currentUser!.id, payload);
  response.status(201).json(check);
});

checksRouter.get('/:id', async (request, response) => {
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});

checksRouter.get('/:id/result', async (request, response) => {
  const result = await getCheckResult(request.params.id, request.currentUser!.id);
  if (!result) {
    throw new HttpError(404, `Check result for ${request.params.id} was not found.`);
  }

  response.json(result);
});

checksRouter.get('/:id/debug-log', async (request, response) => {
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  const debugLog = await getCheckDebugLog(request.params.id);
  if (!debugLog) {
    throw new HttpError(404, `Debug log for ${request.params.id} was not found.`);
  }

  const filename = `${request.params.id}.debug.json`;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('content-disposition', buildAttachmentDisposition(filename));
  response.send(debugLog);
});

checksRouter.get('/:id/fix-download', async (request, response) => {
  await logFixDownloadRouteEvent(request, 'route.fix_download.start');
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    await logFixDownloadRouteEvent(request, 'route.fix_download.not_found');
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  try {
    const fixedDocument = await createFixedDocumentForCheck(request.currentUser!.id, request.params.id, {
      requestId: request.requestId,
      routeMethod: 'GET',
    });
    response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.setHeader('content-disposition', buildAttachmentDisposition(fixedDocument.filename));
    await logFixDownloadRouteEvent(request, 'route.fix_download.send', {
      outputFilename: fixedDocument.filename,
      outputBytes: fixedDocument.buffer.length,
      contentDisposition: response.getHeader('content-disposition'),
    });
    response.send(fixedDocument.buffer);
  } catch (error) {
    await logFixDownloadRouteEvent(request, 'route.fix_download.error', { error });
    const message = error instanceof Error ? error.message : `Fix download for ${request.params.id} failed.`;
    throw new HttpError(500, message);
  }
});

checksRouter.post('/:id/fix-download', async (request, response) => {
  await logFixDownloadRouteEvent(request, 'route.fix_download.start');
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    await logFixDownloadRouteEvent(request, 'route.fix_download.not_found');
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  let payload: ReturnType<typeof fixDownloadSchema.parse>;
  try {
    payload = fixDownloadSchema.parse(request.body);
    await logFixDownloadRouteEvent(request, 'route.fix_download.payload_valid', {
      requestedFixOptions: payload.fixOptions,
    });
  } catch (error) {
    await logFixDownloadRouteEvent(request, 'route.fix_download.payload_invalid', { error });
    throw error;
  }

  try {
    const fixedDocument = await createFixedDocumentForCheckWithOptions(
      request.currentUser!.id,
      request.params.id,
      payload.fixOptions,
      {
        requestId: request.requestId,
        routeMethod: 'POST',
      }
    );
    response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.setHeader('content-disposition', buildAttachmentDisposition(fixedDocument.filename));
    await logFixDownloadRouteEvent(request, 'route.fix_download.send', {
      outputFilename: fixedDocument.filename,
      outputBytes: fixedDocument.buffer.length,
      contentDisposition: response.getHeader('content-disposition'),
    });
    response.send(fixedDocument.buffer);
  } catch (error) {
    await logFixDownloadRouteEvent(request, 'route.fix_download.error', { error });
    const message = error instanceof Error ? error.message : `Fix download for ${request.params.id} failed.`;
    throw new HttpError(500, message);
  }
});

checksRouter.post('/:id/retry', async (request, response) => {
  const check = await retryCheck(request.currentUser!.id, request.params.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});
