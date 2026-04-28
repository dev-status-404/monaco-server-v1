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

    try {
      const queryInterface = sequelize.getQueryInterface();
      const table = await queryInterface.describeTable('withdrawal_requests');
      const destination = table?.destination;

      const destinationType = String(destination?.type || '').toLowerCase();
      const needsWidening =
        destinationType.includes('character varying(255)') ||
        destinationType.includes('varchar(255)');

      if (needsWidening) {
        await queryInterface.changeColumn('withdrawal_requests', 'destination', {
          type: Sequelize.STRING(1024),
          allowNull: false,
        });

        logger.info('Schema updated: withdrawal_requests.destination widened to VARCHAR(1024).');
      }
    } catch (schemaError) {
      logger.warn(`Schema update skipped/failed for withdrawal_requests.destination: ${schemaError?.message || schemaError}`);
    }
  } catch (error) {
    logger.error('Unable to connect to CockroachDB:', error);
    process.exit(1);
  }
};

export { sequelize };

export default dbConnection;