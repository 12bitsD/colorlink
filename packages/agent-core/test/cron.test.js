const test = require('node:test');
const assert = require('node:assert/strict');
const { cronExpression, createCronJob } = require('../src/cron.js');

test('maps simple schedules to five-field cron expressions', () => {
  assert.equal(cronExpression('每天', '16:00'), '0 16 * * *');
  assert.equal(cronExpression('工作日', '09:30'), '30 9 * * 1-5');
  assert.equal(cronExpression('每周五', '18:45'), '45 18 * * 5');
});

test('rejects invalid schedules and times', () => {
  assert.throws(() => cronExpression('每小时', '16:00'), /Unsupported schedule/);
  assert.throws(() => cronExpression('每天', '24:00'), /Invalid local time/);
  assert.throws(() => cronExpression('每天', '16'), /Invalid local time/);
});

test('creates a Prompt job with an explicit local-time contract', () => {
  const job = createCronJob({ prompt: '  整理本周笔记  ', schedule: '每周五', time: '18:45', notify: '完成后提醒' });
  assert.deepEqual(job, {
    prompt: '整理本周笔记',
    schedule: { kind: '每周五', time: '18:45', timeZone: 'Asia/Shanghai' },
    cron: '45 18 * * 5',
    notify: '完成后提醒',
    status: 'SCHEDULED'
  });
});

test('requires a non-empty Prompt', () => {
  assert.throws(() => createCronJob({ prompt: '  ', schedule: '每天', time: '16:00' }), /Prompt is required/);
});
