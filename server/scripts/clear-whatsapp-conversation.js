/**
 * Utility script to clear a WhatsApp conversation (messages + state) for a contact.
 *
 * Usage:
 *   node server/scripts/clear-whatsapp-conversation.js <tenantId> <phone> [--dry-run]
 *
 * Examples:
 *   Preview what will be deleted:
 *     node server/scripts/clear-whatsapp-conversation.js acme-corporation-edc6e9feb8 918291537522 --dry-run
 *
 *   Actually delete (requires confirmation):
 *     node server/scripts/clear-whatsapp-conversation.js acme-corporation-edc6e9feb8 918291537522
 */

import { clearMessages } from '../whatsappConversationService.js';
import { deleteConversationState } from '../conversationStateService.js';

async function askConfirmation(question) {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return answer;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

  if (positionalArgs.length !== 2) {
    console.error('Usage: node server/scripts/clear-whatsapp-conversation.js <tenantId> <phone> [--dry-run]');
    console.error('Example: node server/scripts/clear-whatsapp-conversation.js acme-corporation-edc6e9feb8 918291537522');
    console.error('  --dry-run: Preview what will be deleted without actually deleting');
    process.exit(1);
  }

  const [tenantId, phone] = positionalArgs;
  console.log(`Clearing conversation for tenant=${tenantId} phone=${phone}...`);

  if (dryRun) {
    console.log('[DRY RUN] Would delete all messages and conversation state for this contact.');
    console.log('No changes were made.');
    return;
  }

  console.log('WARNING: This will delete ALL messages and conversation state. This action cannot be undone.');
  const answer = await askConfirmation('Are you sure? Type "yes" to confirm: ');
  if (answer.toLowerCase() !== 'yes') {
    console.log('Aborted. No changes were made.');
    return;
  }

  const { deleted } = await clearMessages(tenantId, phone);
  try {
    await deleteConversationState(tenantId, phone);
  } catch (err) {
    console.warn(`Conversation state not deleted or did not exist: ${err.message}`);
  }
  console.log(`Deleted ${deleted} messages and conversation state.`);
}

main().catch((err) => {
  console.error('Failed to clear conversation:', err.message);
  process.exit(1);
});
