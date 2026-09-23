import { AppConfigs } from './configs/app.config.js';
import { DatabaseConfigs } from './configs/database.config.js';
import { JwtConfigs } from './configs/jwt.config.js';
import { LoggerConfigs } from './configs/logger.config.js';

export type Configs = {
  app: AppConfigs;
  database: DatabaseConfigs;
  jwt: JwtConfigs;
  logger: LoggerConfigs;
};
