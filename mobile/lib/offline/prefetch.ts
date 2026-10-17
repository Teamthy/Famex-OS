/**
 * Silent pre-fetch of upcoming student exams for offline sitting.
 *
 * Called when the student dashboard mounts while online. For each upcoming
 * exam that starts within the next 24 hours AND hasn't been downloaded yet,
 * pulls the offline package and saves it to SQLite. Finishes quickly (<5 s
 * per exam) so it doesn't interrupt the dashboard; errors are swallowed so
 * a flaky network never blocks the UI.
 *
 * We intentionally DO NOT download every exam in the feed — only ones that
 * are imminently sat — because storage on a school phone is shared and
 * question banks can grow into the thousands.
 */
import { studentApi } from "@/lib/api";
import {
  getOfflineExam,
  listDownloadedExams,
  saveOfflinePackage,
} from "@/lib/offline/exams";

const LOOKAHEAD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function prefetchUpcomingExams(): Promise<{ downloaded: number; skipped: number }> {
  let downloaded = 0;
  let skipped = 0;
  try {
    const list: any = await studentApi.exams();
    const exams: any[] =
      list.exams || list.upcoming || list.available || list.open || list || [];
    if (!Array.isArray(exams)) return { downloaded, skipped };

    const already = new Set((await listDownloadedExams()).map((e) => e.id));
    const now = Date.now();

    for (const exam of exams) {
      try {
        if (!exam?.id || already.has(exam.id)) {
          skipped += 1;
          continue;
        }
        const start = exam.scheduledFor ? new Date(exam.scheduledFor).getTime() : 0;
        // Download if either: (a) already open (canStart/canResume), or (b) starts within 24h.
        const soon = start > 0 && start - now < LOOKAHEAD_MS && start - now > -60_000;
        const openNow = exam.canStart || exam.canResume;
        if (!soon && !openNow) continue;

        // Don't re-download if there's an offline attempt already (it may
        // have in-progress answers we mustn't overwrite).
        const existing = await getOfflineExam(exam.id);
        if (existing) {
          already.add(exam.id);
          skipped += 1;
          continue;
        }

        const pkg = await studentApi.downloadOfflineExam(exam.id);
        await saveOfflinePackage(pkg);
        already.add(exam.id);
        downloaded += 1;
      } catch {
        /* one exam failing shouldn't stop the rest */
      }
    }
  } catch {
    /* dashboard load failures aren't fatal here */
  }
  return { downloaded, skipped };
}
