// bun capstone/check.ts <your-folder>: judges your own my-system.md and the evidence it names.
// It never reads the course files, so it works for any system you bring.
import { type CapstoneRule, runCapstoneCheck } from "../checks/capstone";
import rules from "../checks/design-your-own-system";

const capstoneRules: CapstoneRule[] = rules.map((rule) => ({
  says: rule.says,
  test: (folder) => {
    try {
      return rule.test(folder) === true;
    } catch {
      return false;
    }
  },
  tryNext: rule.tryNext,
}));

runCapstoneCheck(capstoneRules);
