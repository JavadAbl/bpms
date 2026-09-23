import process from 'node:process';
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';

export const databaseConfigValidationSchema = {
  DATABASE_URL: Joi.string().required(),
  DATABASE_NAME: Joi.string().default('bpms'),
};

export const databaseConfig = registerAs('database', () => ({
  DATABASE_URL: process.env.DATABASE_URL!,
  DATABASE_NAME: process.env.DATABASE_NAME ?? 'bpms',
}));

export type DatabaseConfigs = ConfigType<typeof databaseConfig>;
