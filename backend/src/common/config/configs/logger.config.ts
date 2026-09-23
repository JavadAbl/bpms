import process from 'node:process';
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';
import { isProd } from './app.config.js';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export const LOG_FREQUENCIES = ['daily', 'hourly', 'weekly'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogFrequencyName = (typeof LOG_FREQUENCIES)[number];
export type LogRotateFrequency = LogFrequencyName | number;

/**
 * Env knobs for this template. Override per project; all are optional.
 *
 * LOG_LEVEL              fatal|error|warn|info|debug|trace|silent  (default: info)
 * LOG_PRETTY             true|false  pretty console; default true unless NODE_ENV is prod
 * LOG_CONSOLE            true|false  write to stdout                 (default: true)
 * LOG_AUTO_LOGGING        true|false  log incoming HTTP requests      (default: true)
 * LOG_FILE_ENABLED        true|false  write rotating files            (default: true, false in test)
 * LOG_DIR                 directory for log files                    (default: logs)
 * LOG_FILE_NAME           base filename without extension                 (default: app)
 * LOG_FILE_EXTENSION      e.g. .log                                  (default: .log)
 * LOG_ROTATE_FREQUENCY    daily|hourly|weekly|<milliseconds>           (default: daily)
 * LOG_RETENTION_DAYS      how long to keep files, in days             (default: 30)
 * LOG_MAX_FILE_SIZE       optional extra rotate by size, e.g. 10m
 */
export const loggerConfigValidationSchema = {
  LOG_LEVEL: Joi.string()
    .valid(...LOG_LEVELS)
    .default('info'),
  LOG_PRETTY: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').optional(),
  LOG_CONSOLE: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').default(true),
  LOG_AUTO_LOGGING: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').default(true),
  LOG_FILE_ENABLED: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').optional(),
  LOG_DIR: Joi.string().default('logs'),
  LOG_FILE_NAME: Joi.string().default('app'),
  LOG_FILE_EXTENSION: Joi.string().default('.log'),
  LOG_ROTATE_FREQUENCY: Joi.string()
    .pattern(/^(daily|hourly|weekly|\d+)$/)
    .default('daily'),
  LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  LOG_MAX_FILE_SIZE: Joi.string()
    .pattern(/^\d+(\.\d+)?[kmgKMG]?$/)
    .allow('')
    .optional(),
};

export const loggerConfig = registerAs('logger', () => {
  const frequencyRaw = process.env.LOG_ROTATE_FREQUENCY ?? 'daily';
  const frequency = parseRotateFrequency(frequencyRaw);
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS ?? 30);
  const isTest = process.env.NODE_ENV?.startsWith('test') ?? false;
  const prettyOverride = parseOptionalBoolean(process.env.LOG_PRETTY);
  const extension = normalizeExtension(process.env.LOG_FILE_EXTENSION ?? '.log');

  return {
    level: (process.env.LOG_LEVEL ?? 'info') as LogLevel,
    pretty: prettyOverride ?? !isProd(),
    console: parseBoolean(process.env.LOG_CONSOLE, true),
    autoLogging: parseBoolean(process.env.LOG_AUTO_LOGGING, true),
    file: {
      enabled: parseBoolean(process.env.LOG_FILE_ENABLED, !isTest),
      dir: process.env.LOG_DIR ?? 'logs',
      name: process.env.LOG_FILE_NAME ?? 'app',
      extension,
      frequency: toPinoFrequency(frequency),
      dateFormat: dateFormatFor(frequencyRaw, frequency),
      retentionCount: toRetentionCount(frequencyRaw, frequency, retentionDays),
      maxSize: process.env.LOG_MAX_FILE_SIZE || undefined,
    },
  };
});

export type LoggerConfigs = ConfigType<typeof loggerConfig>;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

function parseRotateFrequency(value: string): LogRotateFrequency {
  if (value === 'daily' || value === 'hourly' || value === 'weekly') {
    return value;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return 'daily';
}

function toPinoFrequency(frequency: LogRotateFrequency): 'daily' | 'hourly' | number {
  if (frequency === 'weekly') {
    return 7 * 24 * 60 * 60 * 1000;
  }

  return frequency;
}

function dateFormatFor(raw: string, frequency: LogRotateFrequency): string {
  if (raw === 'hourly' || frequency === 'hourly') {
    return 'yyyy-MM-dd-HH';
  }

  if (raw === 'weekly') {
    return 'yyyy-ww';
  }

  return 'yyyy-MM-dd';
}

function toRetentionCount(raw: string, frequency: LogRotateFrequency, days: number): number {
  if (raw === 'hourly' || frequency === 'hourly') {
    return days * 24;
  }

  if (raw === 'weekly') {
    return Math.max(1, Math.ceil(days / 7));
  }

  if (typeof frequency === 'number') {
    return Math.max(1, Math.ceil((days * 86_400_000) / frequency));
  }

  return days;
}

function normalizeExtension(extension: string): string {
  return extension.startsWith('.') ? extension : `.${extension}`;
}
