import {decode} from './firestore.mjs';
const HASH = /^[a-f0-9]{64}$/;

export async function eventReviewJobs(db, jobs, period) {
  if (typeof db?.get !== 'function' && typeof db?.call !== 'function' || !Array.isArray(jobs) || jobs.length > 4 ||
      typeof period?.id !== 'string' || !HASH.test(period.trackId || '')) throw Error('Invalid event review context');
  const reviewed = [];
  for (const job of jobs) {
    const resultId = job.runId || job.resultId;
    if (!HASH.test(resultId || '') || job.trackId !== period.trackId) throw Error('Invalid event review job');
    let run;
    if (typeof db.get === 'function') run = (await db.get('0.6.2_event_runs', resultId))?.data;
    else {
      const raw = await db.call('/0.6.2_event_runs/' + resultId);
      run = raw ? decode({mapValue:{fields:raw.fields||{}}}) : null;
    }
    if (!run || run.runId !== resultId || run.periodId !== period.id || !HASH.test(run.accountId || '') ||
        run.trackId !== job.trackId || run.timeMs !== job.timeMs || run.replayHash !== job.replayHash ||
        !HASH.test(run.replayHash || '') || !Number.isSafeInteger(run.receivedAt) || run.receivedAt <= 0)
      throw Error('Event similarity metadata binding mismatch');
    // Public account identity is required to avoid comparing a racer against their own normal PB.
    reviewed.push({...job,accountId:run.accountId,receivedAt:run.receivedAt});
  }
  return reviewed;
}
