import { Sequelize } from 'sequelize';
import config from './env.js';
import logger from '../utils/logger.js';
const { db } = config;

const tableHasColumn = async (queryInterface, tableName, columnName) => {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table?.[columnName]);
  } catch {
    return false;
  }
};

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const exists = await tableHasColumn(queryInterface, tableName, columnName);
  if (!exists) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const ensureTable = async (queryInterface, tableName, columns) => {
  try {
    await queryInterface.describeTable(tableName);
  } catch {
    await queryInterface.createTable(tableName, columns);
  }
};

const ensurePaymentSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  await ensureColumn(queryInterface, 'users', 'display_name', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await ensureColumn(queryInterface, 'users', 'credits_balance', {
    type: Sequelize.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  });

  await ensureTable(queryInterface, 'user_roles', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    user_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    role: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
  });

  await ensureTable(queryInterface, 'orders', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    user_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    customer_email: { type: Sequelize.STRING, allowNull: false },
    game: { type: Sequelize.STRING, allowNull: false },
    game_username: { type: Sequelize.STRING, allowNull: false },
    payment_method: { type: Sequelize.STRING, allowNull: false },
    payment_provider: { type: Sequelize.STRING, allowNull: false },
    amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
    total_amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
    credits: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
    payment_url: { type: Sequelize.TEXT, allowNull: true },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Pending Payment' },
    transaction_id: { type: Sequelize.STRING, allowNull: true },
    tierlock_order_id: { type: Sequelize.STRING, allowNull: true },
    webhook_received_at: { type: Sequelize.DATE, allowNull: true },
    approved_at: { type: Sequelize.DATE, allowNull: true },
    rejected_at: { type: Sequelize.DATE, allowNull: true },
    credits_sent_at: { type: Sequelize.DATE, allowNull: true },
    admin_notes: { type: Sequelize.TEXT, allowNull: true },
    payment_opened_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await ensureColumn(queryInterface, 'orders', 'approved_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureColumn(queryInterface, 'orders', 'rejected_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureTable(queryInterface, 'payout_requests', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    user_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    customer_email: { type: Sequelize.STRING, allowNull: false },
    game: { type: Sequelize.STRING, allowNull: false },
    game_username: { type: Sequelize.STRING, allowNull: false },
    amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
    payout_method: { type: Sequelize.STRING, allowNull: false },
    payout_account: { type: Sequelize.STRING(1024), allowNull: false },
    customer_phone: { type: Sequelize.STRING(32), allowNull: false },
    note: { type: Sequelize.TEXT, allowNull: true },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Redeem Requested' },
    tierlock_order_id: { type: Sequelize.STRING, allowNull: true },
    tierlock_transaction_id: { type: Sequelize.STRING, allowNull: true },
    webhook_event: { type: Sequelize.STRING, allowNull: true },
    webhook_status: { type: Sequelize.STRING, allowNull: true },
    webhook_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    webhook_received_at: { type: Sequelize.DATE, allowNull: true },
    raw_webhook_payload: { type: Sequelize.JSONB, allowNull: true },
    status_history: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    admin_notes: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await ensureColumn(queryInterface, 'payout_requests', 'customer_phone', {
    type: Sequelize.STRING(32),
    allowNull: true,
  });

  await ensureTable(queryInterface, 'payment_webhook_logs', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    provider: { type: Sequelize.STRING, allowNull: false, defaultValue: 'tierlock' },
    event_type: { type: Sequelize.STRING, allowNull: true },
    transaction_id: { type: Sequelize.STRING, allowNull: true },
    order_id: { type: Sequelize.STRING, allowNull: true },
    signature_present: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    processing_result: { type: Sequelize.STRING, allowNull: false },
    error: { type: Sequelize.TEXT, allowNull: true },
    payload: { type: Sequelize.JSONB, allowNull: true },
    headers: { type: Sequelize.JSONB, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await ensureColumn(queryInterface, 'payment_webhook_logs', 'error', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureTable(queryInterface, 'payout_webhook_logs', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    provider: { type: Sequelize.STRING, allowNull: false, defaultValue: 'tierlock' },
    event: { type: Sequelize.STRING, allowNull: true },
    status: { type: Sequelize.STRING, allowNull: true },
    signature_present: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    processing_result: { type: Sequelize.STRING, allowNull: false },
    payout_request_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'payout_requests', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    payload: { type: Sequelize.JSONB, allowNull: true },
    headers: { type: Sequelize.JSONB, allowNull: true },
    signature_header: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await ensureTable(queryInterface, 'audit_logs', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    actor_user_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    entity_type: { type: Sequelize.STRING, allowNull: false },
    entity_id: { type: Sequelize.UUID, allowNull: false },
    action: { type: Sequelize.STRING, allowNull: false },
    from_status: { type: Sequelize.STRING, allowNull: true },
    to_status: { type: Sequelize.STRING, allowNull: true },
    metadata: { type: Sequelize.JSONB, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await ensureTable(queryInterface, 'system_settings', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    key: { type: Sequelize.STRING, allowNull: false, unique: true },
    value: { type: Sequelize.JSONB, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });
};

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
       await sequelize.sync({ force: false });
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

    try {
      await ensurePaymentSchema();
      logger.info('Payment and payout schema ensured.');
    } catch (schemaError) {
      logger.warn(`Payment schema ensure skipped/failed: ${schemaError?.message || schemaError}`);
    }
  } catch (error) {
    logger.error('Unable to connect to CockroachDB:', error);
    process.exit(1);
  }
};

export { sequelize };

export default dbConnection;
