import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

export type AuthedUser = {
  token: string;
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
};

/** Seeded accounts used by the IT service-request process. */
export const USERS = {
  admin: { username: 'admin', password: 'admin123' },
  john: { username: 'john', password: 'user123' },
  jane: { username: 'jane', password: 'user123' },
  ali: { username: 'ali', password: 'user123' },
  bob: { username: 'bob', password: 'user123' },
} as const;

export async function login(
  app: INestApplication<App>,
  username: string,
  password: string,
): Promise<AuthedUser> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password })
    .expect((r) => {
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(`login ${username} failed: ${r.status} ${JSON.stringify(r.body)}`);
      }
    });

  const body = res.body as {
    accessToken: string;
    userId: string;
    username: string;
    email: string;
    name: string;
    role: string;
  };

  if (!body.accessToken || !body.userId) {
    throw new Error(`login ${username}: unexpected reply ${JSON.stringify(body)}`);
  }

  return {
    token: body.accessToken,
    id: body.userId,
    username: body.username,
    email: body.email,
    name: body.name,
    role: body.role,
  };
}

export function authHeader(user: AuthedUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}
