import process from 'node:process';
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';
import { APP_ENVIRONMENTS } from '../envs.js';

export const appConfigValidationSchema = {
  APP_PORT: Joi.number().port().required(),
  NODE_ENV: Joi.string()
    .valid(...APP_ENVIRONMENTS)
    .required(),
};

// config
export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV!,
  port: process.env.APP_PORT!,
}));

export type AppConfigs = ConfigType<typeof appConfig>;

export const isProd = (): boolean => {
  return process?.env?.NODE_ENV?.startsWith('prod') ?? false;
};

export const isDev = (): boolean => {
  return process?.env?.NODE_ENV?.startsWith('dev') ?? true;
};
