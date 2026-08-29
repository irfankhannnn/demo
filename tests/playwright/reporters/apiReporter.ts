import type {
  FullConfig, Suite, TestCase, TestResult, Reporter,
} from '@playwright/test/reporter';

/**
 * Simple API Test Reporter
 * Shows clean pass/fail output with test names and error details.
 * No browser screenshots, no videos — just API call results.
 */
export default class ApiReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private suiteName = '';
  private startTime = 0;

  onBegin(config: FullConfig, suite: Suite) {
    this.startTime = Date.now();
    console.log('\n============================================');
    console.log('  API TEST RESULTS');
    console.log('============================================\n');
  }

  onTestBegin(test: TestCase) {
    // Print suite name when it changes
    const newSuite = test.titlePath()[1] || 'Tests';
    if (newSuite !== this.suiteName) {
      this.suiteName = newSuite;
      console.log(`\n${this.suiteName}`);
      console.log('─'.repeat(this.suiteName.length));
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const icon = result.status === 'passed' ? '✓' :
                 result.status === 'skipped' ? '⊘' : '✗';
    const testName = test.title;

    if (result.status === 'passed') {
      this.passed++;
      console.log(`  ${icon} ${testName}`);
    } else if (result.status === 'skipped') {
      this.skipped++;
      console.log(`  ${icon} ${testName}  (skipped)`);
    } else {
      this.failed++;
      console.log(`  ${icon} ${testName}`);
      // Show error in simple terms
      if (result.error?.message) {
        const shortError = result.error.message.split('\n')[0].slice(0, 120);
        console.log(`     → ${shortError}`);
      }
    }
  }

  onEnd(result: FullResult) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const total = this.passed + this.failed + this.skipped;

    console.log('\n────────────────────────────────────────────');
    console.log(`  Total:  ${total} tests`);
    console.log(`  Passed: ${this.passed}  ✓`);
    if (this.failed > 0) console.log(`  Failed: ${this.failed}  ✗`);
    if (this.skipped > 0) console.log(`  Skipped: ${this.skipped} ⊘`);
    console.log(`  Time:   ${duration}s`);
    console.log('============================================\n');
  }
}
