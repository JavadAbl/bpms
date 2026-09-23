import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export function enumToObject<E extends Record<string, string | number>>(e: E): { [K in keyof E]: E[K] } {
  // Filter out the reverse‑mapping entries that appear only for numeric enums
  const entries = Object.entries(e).filter(
    ([k]) => Number.isNaN(Number(k)), // keep only the named keys
  );

  // `Object.fromEntries` returns `Record<string, unknown>`; we cast to the desired type
  return Object.fromEntries(entries) as { [K in keyof E]: E[K] };
}

export async function validateOrRejectObject<T extends object>(model: new () => T, obj: object) {
  const instance = plainToInstance(model, obj, { excludeExtraneousValues: true });
  await validateOrReject(instance);
  return instance;
}

export const random5Digit = () => Math.floor(Math.random() * 90000) + 10000;
