#!/usr/bin/env node
/**
 * Report the state of the vector indexes.
 *
 * Exists because the failure it detects is silent: querying an index that is
 * still backfilling returns partial results with no error, which reads to a
 * user as "we have nothing matching that" rather than as a fault. There is no
 * way to tell those apart from the application side, so the check belongs here.
 *
 * Exit code 0 when every expected index is ACTIVE and no longer backfilling,
 * 1 otherwise — so it can gate a smoke test in a script.
 */

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const client = new DynamoDBClient({ region: REGION });

const EXPECTED = [
  { table: process.env.CRM_DYNAMODB_TABLE_NAME, index: 'property-vector-index' },
  { table: process.env.CRM_DYNAMODB_TABLE_NAME, index: 'marketplace-vector-index' },
  { table: process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME, index: 'knowledge-vector-index' },
];

let allReady = true;

for (const { table, index } of EXPECTED) {
  if (!table) {
    console.log(`?  ${index}: table name not set in env`);
    allReady = false;
    continue;
  }

  try {
    const { Table } = await client.send(new DescribeTableCommand({ TableName: table }));
    const found = (Table.VectorIndexes || []).find((i) => i.IndexName === index);

    if (!found) {
      console.log(`✗  ${index} on ${table}: does not exist`);
      allReady = false;
      continue;
    }

    const backfilling = found.Backfilling === true;
    const ready = found.IndexStatus === 'ACTIVE' && !backfilling;
    if (!ready) allReady = false;

    console.log(
      `${ready ? '✓' : '…'}  ${index} on ${table}: ${found.IndexStatus}` +
        (backfilling ? ' (backfilling — not yet searchable)' : '') +
        (found.ItemCount != null ? `, ${found.ItemCount} items` : '')
    );
  } catch (error) {
    console.log(`✗  ${index} on ${table}: ${error.name} — ${error.message}`);
    allReady = false;
  }
}

process.exit(allReady ? 0 : 1);
