/**
 * Shared DynamoDB pagination helpers for Scan/Query loops.
 * Prefer Query + GSI when available; use scanAllPages only when tenant filter
 * must be applied via FilterExpression on a Scan.
 */

/**
 * Exhaustively paginate a DynamoDB DocumentClient Scan or Query.
 *
 * @param {object} docClient - DynamoDBDocumentClient
 * @param {new (input: object) => object} CommandClass - ScanCommand or QueryCommand
 * @param {object} baseParams - Command input (without ExclusiveStartKey)
 * @param {object} [options]
 * @param {number} [options.maxItems] - Soft cap on accumulated items (stops early)
 * @param {number} [options.maxPages=100] - Safety cap on page iterations
 * @returns {Promise<object[]>}
 */
export async function collectAllPages(docClient, CommandClass, baseParams, options = {}) {
  const maxItems = options.maxItems ?? Infinity;
  const maxPages = options.maxPages ?? 100;
  const items = [];
  let ExclusiveStartKey;
  let pages = 0;

  do {
    const result = await docClient.send(
      new CommandClass({
        ...baseParams,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      }),
    );

    if (Array.isArray(result.Items) && result.Items.length) {
      items.push(...result.Items);
    }

    ExclusiveStartKey = result.LastEvaluatedKey;
    pages += 1;

    if (items.length >= maxItems) {
      return items.slice(0, maxItems);
    }
  } while (ExclusiveStartKey && pages < maxPages);

  return items;
}

/**
 * Paginate once and return items + next cursor for API responses.
 *
 * @returns {Promise<{ items: object[], lastEvaluatedKey: object|undefined }>}
 */
export async function collectPage(docClient, CommandClass, baseParams, exclusiveStartKey) {
  const result = await docClient.send(
    new CommandClass({
      ...baseParams,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    }),
  );

  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}
