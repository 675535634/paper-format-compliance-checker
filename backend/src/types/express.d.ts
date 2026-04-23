import type { AuthUser } from './index.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthUser;
      authToken?: string;
    }
  }
}

export {};
