import { Sequelize } from 'sequelize';
import config from './env.js';
import logger from '../utils/logger.js';
const { db } = config;

// Create Sequelize instance - support both connection string and individual parameters
let sequelize;

if (db.url) {
  // If a connection URL is provided, use it (common for CockroachDB)
  sequelize = new Sequelize(db.url, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false
      },
      application_name: 'trade-backend'
    },
    logging: (msg) => logger.debug(msg)
  });
} else {
  // Otherwise use individual connection parameters
  sequelize = new Sequelize(db.name, db.user, db.password, {
    host: db.host,
    port: db.port,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false // You may need to set this to true in production with proper certificates
      },
      application_name: 'trade-backend'
    },
    logging: (msg) => logger.debug(msg),
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

const dbConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('CockroachDB connection has been established successfully.');
    
    if (config.env === 'development') {
      // In development, you might want to sync tables
      // For CockroachDB, use { force: false } to avoid dropping tables
      //  await sequelize.sync({ force: false });
    } else {
      // await sequelize.sync({ force: false });
    }
    
    logger.info('Database synchronized.');
  } catch (error) {
    logger.error('Unable to connect to CockroachDB:', error);
    process.exit(1);
  }
};

export { sequelize };

export default dbConnection;