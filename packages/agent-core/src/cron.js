(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PocketAgent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const scheduleDays = Object.freeze({ '每天': '*', '工作日': '1-5', '每周五': '5' });

  function cronExpression(schedule, time) {
    if (!Object.hasOwn(scheduleDays, schedule)) throw new RangeError(`Unsupported schedule: ${schedule}`);
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) throw new RangeError(`Invalid local time: ${time}`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new RangeError(`Invalid local time: ${time}`);
    return `${minute} ${hour} * * ${scheduleDays[schedule]}`;
  }

  function createCronJob({ prompt, schedule, time, timeZone = 'Asia/Shanghai', notify = '仅异常提醒' }) {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) throw new RangeError('Prompt is required');
    if (!timeZone) throw new RangeError('Time zone is required');
    return {
      prompt: cleanPrompt,
      schedule: { kind: schedule, time, timeZone },
      cron: cronExpression(schedule, time),
      notify,
      status: 'SCHEDULED'
    };
  }

  return Object.freeze({ cronExpression, createCronJob });
});
