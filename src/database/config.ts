import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const defaultConfig: TypeOrmModuleOptions = {
  name: 'default',
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  logger: 'advanced-console',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const secondConfig: TypeOrmModuleOptions = {
  name: 'secondConnection',
  type: 'postgres',
  host: process.env.SECOND_DB_HOST,
  port: parseInt(process.env.SECOND_DB_PORT, 10) || 5432,
  username: process.env.SECOND_DB_USERNAME,
  password: process.env.SECOND_DB_PASSWORD,
  database: process.env.SECOND_DB_DATABASE,
  entities: [__dirname + '/**/*.second-entity{.ts,.js}'],
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  logger: 'advanced-console',
  ssl: process.env.SECOND_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export default [defaultConfig, secondConfig];