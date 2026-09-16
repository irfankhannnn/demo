// A small in-memory stand-in for the DynamoDB document client, covering only
// the expression shapes dynamodbService.js actually uses. Enough to run the
// job engine end to end in tests without AWS.

function resolveName(token, names) {
  return names?.[token] ?? token;
}

function resolveValue(token, values) {
  if (!(token in (values || {}))) throw new Error(`unresolved value ${token}`);
  return values[token];
}

function conditionFailed() {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

export class FakeDocClient {
  constructor() {
    this.items = new Map();
    this.calls = [];
  }

  key(item) {
    return `${item.PK}|${item.SK}`;
  }

  async send(command) {
    const name = command.constructor.name;
    const input = command.input;
    this.calls.push({ name, input });
    switch (name) {
      case 'PutCommand': return this.put(input);
      case 'GetCommand': return this.get(input);
      case 'UpdateCommand': return this.update(input);
      case 'QueryCommand': return this.query(input);
      case 'DeleteCommand': return this.delete(input);
      default: throw new Error(`FakeDocClient: unsupported command ${name}`);
    }
  }

  put({ Item, ConditionExpression }) {
    const k = this.key(Item);
    if (ConditionExpression === 'attribute_not_exists(PK)' && this.items.has(k)) throw conditionFailed();
    this.items.set(k, structuredClone(Item));
    return {};
  }

  get({ Key }) {
    const item = this.items.get(this.key(Key));
    return { Item: item ? structuredClone(item) : undefined };
  }

  delete({ Key }) {
    this.items.delete(this.key(Key));
    return {};
  }

  checkCondition(expr, item, names, values) {
    if (!expr) return;
    const inMatch = /^(#\w+) IN \((.+)\)$/.exec(expr.trim());
    if (inMatch) {
      const attr = resolveName(inMatch[1], names);
      const allowed = inMatch[2].split(',').map((t) => resolveValue(t.trim(), values));
      if (!item || !allowed.includes(item[attr])) throw conditionFailed();
      return;
    }
    throw new Error(`FakeDocClient: unsupported condition ${expr}`);
  }

  update({ Key, UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues, ConditionExpression }) {
    const k = this.key(Key);
    const existing = this.items.get(k);
    this.checkCondition(ConditionExpression, existing, ExpressionAttributeNames, ExpressionAttributeValues);
    const item = existing ? structuredClone(existing) : { ...Key };
    const body = UpdateExpression.replace(/^SET\s+/, '');
    for (const part of body.split(/,\s*(?=[#A-Za-z])/)) {
      const [lhs, rhs] = part.split('=').map((s) => s.trim());
      item[resolveName(lhs, ExpressionAttributeNames)] = resolveValue(rhs, ExpressionAttributeValues);
    }
    this.items.set(k, item);
    return { Attributes: structuredClone(item) };
  }

  query({ KeyConditionExpression, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues, ScanIndexForward, Limit }) {
    const names = ExpressionAttributeNames;
    const values = ExpressionAttributeValues;
    const clauses = KeyConditionExpression.split(/\s+AND\s+/);
    let hashAttr; let hashVal; let rangeAttr; let rangeOp; let rangeVal;
    for (const clause of clauses) {
      const bw = /^begins_with\((\w+),\s*(:\w+)\)$/.exec(clause.trim());
      if (bw) { rangeAttr = bw[1]; rangeOp = 'begins_with'; rangeVal = resolveValue(bw[2], values); continue; }
      const cmp = /^(\S+)\s*(=|<=|>=|<|>)\s*(:\w+)$/.exec(clause.trim());
      if (!cmp) throw new Error(`FakeDocClient: unsupported key condition ${clause}`);
      const attr = resolveName(cmp[1], names);
      const val = resolveValue(cmp[3], values);
      if (cmp[2] === '=' && hashAttr === undefined) { hashAttr = attr; hashVal = val; } else { rangeAttr = attr; rangeOp = cmp[2]; rangeVal = val; }
    }
    let rows = [...this.items.values()].filter((it) => it[hashAttr] === hashVal);
    if (rangeAttr) {
      rows = rows.filter((it) => {
        const v = it[rangeAttr];
        if (v === undefined) return false;
        switch (rangeOp) {
          case 'begins_with': return String(v).startsWith(rangeVal);
          case '<=': return v <= rangeVal;
          case '<': return v < rangeVal;
          case '>=': return v >= rangeVal;
          case '>': return v > rangeVal;
          default: return v === rangeVal;
        }
      });
      rows.sort((a, b) => (a[rangeAttr] < b[rangeAttr] ? -1 : a[rangeAttr] > b[rangeAttr] ? 1 : 0));
    }
    if (ScanIndexForward === false) rows.reverse();
    if (FilterExpression) {
      const m = /^(\S+)\s*=\s*(:\w+)$/.exec(FilterExpression.trim());
      if (!m) throw new Error(`FakeDocClient: unsupported filter ${FilterExpression}`);
      const attr = resolveName(m[1], names);
      const val = resolveValue(m[2], values);
      rows = rows.filter((it) => it[attr] === val);
    }
    if (Limit) rows = rows.slice(0, Limit);
    return { Items: rows.map((r) => structuredClone(r)) };
  }
}

export default FakeDocClient;
