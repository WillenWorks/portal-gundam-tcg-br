// Apaga do disco os relatos de bug já corrigidos: `pnpm bug-report:resolve BUG-XXXXXX [BUG-YYYYYY …]`.
import { defaultBugReportsDir, removeBugReportFromDisk } from "../server/services/bugReportDiskService.ts";

const codes = process.argv.slice(2).map((c) => c.trim().toUpperCase()).filter(Boolean);
if (codes.length === 0) {
  console.error("Uso: pnpm bug-report:resolve BUG-XXXXXX [BUG-YYYYYY …]");
  process.exit(1);
}

let failed = false;
for (const code of codes) {
  try {
    const removed = await removeBugReportFromDisk(code);
    console.log(removed > 0 ? `${code}: ${removed} pasta(s) apagada(s) de ${defaultBugReportsDir()}` : `${code}: nenhum relato em disco`);
  } catch (err) {
    failed = true;
    console.error(`${code}: ${err instanceof Error ? err.message : err}`);
  }
}
process.exit(failed ? 1 : 0);
