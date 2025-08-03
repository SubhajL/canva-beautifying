import { Worker, Job } from 'bullmq';
import { getQueueConfig } from '../config';
import { BetaNotificationService } from '@/lib/services/email/betaNotifications';

interface BetaEmailJobData {
  messageId: string;
  action: 'send' | 'test';
  testEmail?: string;
}

export const createBetaEmailWorker = () => {
  const config = getQueueConfig();
  
  const worker = new Worker<BetaEmailJobData>(
    'beta-emails',
    async (job: Job<BetaEmailJobData>) => {
      const { messageId, action, testEmail } = job.data;

      console.log(`Processing beta email job: ${action} for message ${messageId}`);

      try {
        // Update job progress
        await job.updateProgress(10);

        if (action === 'send') {
          await BetaNotificationService.sendBetaMessageEmails(messageId);
          await job.updateProgress(100);
          return { 
            success: true, 
            messageId,
            action: 'send',
            timestamp: new Date().toISOString()
          };
        } else if (action === 'test' && testEmail) {
          const result = await BetaNotificationService.sendTestEmail(messageId, testEmail);
          await job.updateProgress(100);
          return { 
            success: true, 
            messageId,
            action: 'test',
            testEmail,
            resendId: result.id,
            timestamp: new Date().toISOString()
          };
        } else {
          throw new Error('Invalid action or missing test email');
        }
      } catch (error) {
        console.error('Beta email job failed:', error);
        throw error;
      }
    },
    {
      connection: config.connection,
      concurrency: config.workerOptions.concurrency || 5,
      removeOnComplete: {
        count: 100,
        age: 24 * 3600 // 24 hours
      },
      removeOnFail: {
        count: 50
      }
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`Beta email job ${job.id} completed:`, job.returnvalue);
  });

  worker.on('failed', (job, err) => {
    console.error(`Beta email job ${job?.id} failed:`, err);
  });

  worker.on('error', (err) => {
    console.error('Beta email worker error:', err);
  });

  return worker;
};