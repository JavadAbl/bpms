import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Params } from 'nestjs-pino';
import type { TransportTargetOptions } from 'pino';
import { Configs } from '#common/config/config.type.js';
import { LoggerConfigs } from '#common/config/configs/logger.config.js';

export const getLoggerAsyncConfig = (configService: ConfigService<Configs, true>): Params => {
  const logger = configService.get('logger', { infer: true });
  const targets = buildTargets(logger);

  return {
    pinoHttp: {
      level: logger.level,
      autoLogging: logger.autoLogging,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const header = req.headers['x-request-id'];
        const existing = Array.isArray(header) ? header[0] : header;
        const id = existing || randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      serializers: {
        req: (req: any) => {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            ip: getClientIp(req), // 👈 Logs the real client IP
          };
        },
        res: (res: any) => {
          return { statusCode: res.statusCode };
        },
      },

      redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true },
      transport: { targets },
    },
  };
};

function buildTargets(logger: LoggerConfigs): TransportTargetOptions[] {
  const targets: TransportTargetOptions[] = [];

  if (logger.console) {
    targets.push(
      logger.pretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
              messageKey: 'msg',
            },
          }
        : { target: 'pino/file', options: { destination: 1 } },
    );
  }

  if (logger.file.enabled) {
    const { dir, name, extension, frequency, dateFormat, retentionCount, maxSize } = logger.file;

    targets.push({
      target: 'pino-roll',
      options: {
        file: path.join(process.cwd(), dir, name),
        frequency,
        mkdir: true,
        extension,
        dateFormat,
        limit: { count: retentionCount, removeOtherLogFiles: true },
        ...(maxSize ? { size: maxSize } : {}),
      },
    });
  }

  if (targets.length === 0) {
    targets.push({ target: 'pino/file', options: { destination: 1 } });
  }

  return targets;
}

function getClientIp(req: any): string | undefined {
  // 1. X-Forwarded-For (Standard proxy header, can contain a comma-separated list: "client, proxy1, proxy2")
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    if (ip) return ip;
  }

  // 2. Cloudflare specific header
  if (req.headers?.['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }

  // 3. Nginx / standard proxy header
  if (req.headers?.['x-real-ip']) {
    return req.headers['x-real-ip'];
  }

  // 4. Fallback to direct socket connection (will be proxy IP if behind one, but good as a last resort)
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
}
