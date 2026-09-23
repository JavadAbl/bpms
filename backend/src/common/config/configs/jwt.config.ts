import process from 'node:process';
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';

export const jwtConfigValidationSchema = {
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
};

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
}));

export type JwtConfigs = ConfigType<typeof jwtConfig>;
