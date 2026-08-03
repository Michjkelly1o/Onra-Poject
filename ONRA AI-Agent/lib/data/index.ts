// Swap point: mock today, Onra API later. Flip DATA_SOURCE=api in .env.local.
import type { StudioRepository } from "@/lib/data/StudioRepository";
import { MockStudioRepository } from "@/lib/data/mock/MockStudioRepository";

// When the Onra API exists, implement ApiStudioRepository (same interface) and:
//   export const repo = process.env.DATA_SOURCE === "api"
//     ? new ApiStudioRepository() : new MockStudioRepository();
export const repo: StudioRepository = new MockStudioRepository();
