import 'dotenv/config';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { SupabaseClient } from '@supabase/supabase-js';
import { CronJob } from 'cron';
import { logger } from './utils/logger';
import { supabase } from './utils/supabase';
import { checkOverdueInvoices } from './handlers/checkOverdueInvoices';

// Initialize JSON codec for NATS messages
const jsonCodec = JSONCodec();

// Subscriptions to clean up on exit
const subscriptions: Subscription[] = [];

// Supabase client
let supabaseClient: SupabaseClient;

// NATS client
let natsClient: NatsConnection;

// Cron job reference
let reminderCronJob: CronJob;

/**
 * Connect to dependencies and start service
 */
async function start() {
  try {
    logger.info('Starting reminder service...');
    
    // Supabase client is already initialized in utils/supabase.ts
    supabaseClient = supabase;
    logger.info('Using pre-configured Supabase client');
    
    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    logger.info(`Connecting to NATS at ${natsUrl}`);
    
    natsClient = await connect({
      servers: natsUrl,
      reconnect: true,
      maxReconnectAttempts: -1, // Unlimited reconnect attempts
      reconnectTimeWait: 1000,
    });
    
    logger.info(`Connected to ${natsClient.getServer()}`);
    
    // Set up reminder thresholds from environment variables
    const reminderThresholds = {
      first: parseInt(process.env.REMINDER_FIRST_DAYS || '3', 10),
      second: parseInt(process.env.REMINDER_SECOND_DAYS || '7', 10),
      third: parseInt(process.env.REMINDER_FINAL_DAYS || '14', 10)
    };
    
    logger.info(`Reminder thresholds set to: first=${reminderThresholds.first}, second=${reminderThresholds.second}, third=${reminderThresholds.third} days`);
    
    // Set up subscription handlers
    setupSubscriptions(reminderThresholds);
    
    // Set up cron job for scheduled invoice checking
    const cronExpression = process.env.REMINDER_CRON || '0 10 * * *'; // Default: 10:00 AM every day
    setupCronJob(cronExpression, reminderThresholds);
    
    // Handle process termination
    setupGracefulShutdown();
    
    logger.info('Reminder service started successfully');
  } catch (error) {
    logger.error(`Failed to start service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Set up NATS subscriptions for service
 */
function setupSubscriptions(reminderThresholds: { first: number; second: number; third: number }) {
  try {
    // Handle manual check requests
    const checkOverdueSub = natsClient.subscribe('reminder.check.request');
    subscriptions.push(checkOverdueSub);
    logger.info('Subscribed to reminder.check.request');
    
    (async () => {
      for await (const msg of checkOverdueSub) {
        try {
          logger.info('Received manual request to check overdue invoices');
          
          const result = await checkOverdueInvoices(supabaseClient, natsClient, reminderThresholds);
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling reminder.check.request: ${error instanceof Error ? error.message : String(error)}`);
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      }
    })();
  } catch (error) {
    logger.error(`Error setting up subscriptions: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Set up cron job for scheduled invoice checking
 */
function setupCronJob(cronExpression: string, reminderThresholds: { first: number; second: number; third: number }) {
  try {
    logger.info(`Setting up cron job with schedule: ${cronExpression}`);
    
    reminderCronJob = new CronJob(
      cronExpression,
      async () => {
        try {
          logger.info('Running scheduled check for overdue invoices');
          await checkOverdueInvoices(supabaseClient, natsClient, reminderThresholds);
        } catch (error) {
          logger.error(`Error in scheduled overdue invoice check: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      null, // onComplete
      true,  // start
      'Europe/Paris' // timezone
    );
    
    logger.info('Cron job started');
    
    // Log next scheduled runs
    const nextDates = [];
    for (let i = 0; i < 5; i++) {
      nextDates.push(reminderCronJob.nextDate().toJSDate());
    }
    
    logger.info(`Next 5 scheduled runs: ${nextDates.map(d => d.toISOString()).join(', ')}`);
  } catch (error) {
    logger.error(`Error setting up cron job: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Set up graceful shutdown for CTRL+C and process termination
 */
function setupGracefulShutdown() {
  const shutdown = async () => {
    logger.info('Shutting down reminder service...');
    
    // Stop cron job
    if (reminderCronJob) {
      reminderCronJob.stop();
      logger.info('Stopped cron job');
    }
    
    // Unsubscribe from all subscriptions
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
    
    // Close NATS connection
    if (natsClient) {
      await natsClient.close();
      logger.info('NATS connection closed');
    }
    
    process.exit(0);
  };
  
  // Handle CTRL+C
  process.on('SIGINT', shutdown);
  
  // Handle process termination
  process.on('SIGTERM', shutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    shutdown();
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, _promise: Promise<unknown>) => {
    logger.error(`Unhandled promise rejection: ${reason}`);
    shutdown();
  });
}

// Start the service
start();
