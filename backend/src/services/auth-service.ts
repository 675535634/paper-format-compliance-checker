import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { updateDatabase, readDatabase } from '../storage/database.js';
import type { AuthSession, AuthUser, UserRecord } from '../types/index.js';
import { createId } from './id-service.js';
import { createStarterTemplatesForUser } from './template-service.js';

const now = () => new Date().toISOString();
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashValue = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const derivePasswordHash = (password: string, salt: string): string =>
  scryptSync(password, salt, 64).toString('hex');

const toAuthUser = (user: UserRecord): AuthUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
});

const findUserByIdentifier = (users: UserRecord[], identifier: string): UserRecord | undefined => {
  const normalized = identifier.trim().toLowerCase();
  return users.find((user) =>
    user.username.toLowerCase() === normalized || user.email.toLowerCase() === normalized
  );
};

const verifyPassword = (password: string, user: UserRecord): boolean => {
  const expected = Buffer.from(user.passwordHash, 'hex');
  const actual = Buffer.from(derivePasswordHash(password, user.passwordSalt), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const issueToken = async (user: UserRecord): Promise<AuthSession> => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await updateDatabase((state) => ({
    state: {
      ...state,
      authTokens: [
        ...state.authTokens.filter((record) => record.userId !== user.id || record.expiresAt > now()),
        {
          id: createId('token'),
          userId: user.id,
          tokenHash: hashValue(token),
          createdAt: now(),
          expiresAt,
        },
      ],
    },
    result: undefined,
  }));

  return {
    token,
    user: toAuthUser(user),
    expiresAt,
  };
};

export const registerUser = async (input: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthSession> => {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || username;

  const user = await updateDatabase((state) => {
    const usernameTaken = state.users.some((item) => item.username.toLowerCase() === username.toLowerCase());
    if (usernameTaken) {
      throw new Error('Username is already in use.');
    }

    const emailTaken = state.users.some((item) => item.email.toLowerCase() === email);
    if (emailTaken) {
      throw new Error('Email is already in use.');
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = derivePasswordHash(input.password, passwordSalt);
    const createdAt = now();
    const nextUser: UserRecord = {
      id: createId('user'),
      username,
      email,
      passwordHash,
      passwordSalt,
      displayName,
      createdAt,
      updatedAt: createdAt,
    };

    return {
      state: {
        ...state,
        users: [...state.users, nextUser],
      },
      result: nextUser,
    };
  });

  await createStarterTemplatesForUser(user.id);
  return issueToken(user);
};

export const loginUser = async (input: {
  identifier: string;
  password: string;
}): Promise<AuthSession> => {
  const db = await readDatabase();
  const user = findUserByIdentifier(db.users, input.identifier);
  if (!user || !verifyPassword(input.password, user)) {
    throw new Error('Invalid username/email or password.');
  }

  return issueToken(user);
};

export const getAuthUserFromToken = async (token: string): Promise<AuthUser | undefined> => {
  if (!token) {
    return undefined;
  }

  const tokenHash = hashValue(token);
  const db = await readDatabase();
  const session = db.authTokens.find((record) => record.tokenHash === tokenHash);
  if (!session) {
    return undefined;
  }

  if (session.expiresAt <= now()) {
    await revokeToken(token);
    return undefined;
  }

  const user = db.users.find((item) => item.id === session.userId);
  return user ? toAuthUser(user) : undefined;
};

export const revokeToken = async (token: string): Promise<void> => {
  const tokenHash = hashValue(token);
  await updateDatabase((state) => ({
    state: {
      ...state,
      authTokens: state.authTokens.filter((record) => record.tokenHash !== tokenHash),
    },
    result: undefined,
  }));
};
