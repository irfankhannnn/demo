import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

export interface SubscriptionItem {
  tenantId: string;
  plan: string;
  seatsPaid: number;
  seatsUsed: number;
  trialEndsAt?: string;
  isPaying: boolean;
  gracePeriodActive: boolean;
  paymentStatus: string;
  razorpaySubscriptionId?: string;
  nextBillingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getSubscription(tenantId: string): Promise<SubscriptionItem | null> {
  const result = await dynamodb
    .get({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { tenantId },
    })
    .promise();

  return (result.Item as SubscriptionItem) || null;
}
