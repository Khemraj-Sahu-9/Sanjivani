/**
 * backend/src/types/express.d.ts
 *
 * Express request user typing for Sanjivani authenticated routes.
 */

import { UserProfile } from './models.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export {};
