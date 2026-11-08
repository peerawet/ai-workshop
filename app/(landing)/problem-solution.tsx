import { Chip } from "@/components/base/badges/chip";
import { ProblemCards } from "./problem-cards";
import { ProblemScene } from "./scenes";
import { LandingSection } from "./section";

export function ProblemSolution() {
  return (
    <LandingSection id="why" title="หาหอเองเหนื่อยตรงไหน DormDee แก้ให้">
      <div className="grid items-center gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        {/*
          A phone whose screen plays the card that is active beside it: the old way first, then
          DormDee's answer (three/problem.ts). Decorative; the copy lives in the cards.
        */}
        <div
          data-reveal
          className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default shadow-md sm:aspect-[4/3] lg:aspect-[4/5]"
        >
          <ProblemScene className="absolute inset-0 -z-10" />
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <p className="text-caption-1-medium text-text-secondary">ก่อนและหลังใช้ DormDee</p>
            <Chip color="soft" variant="caption">
              ตัวอย่าง
            </Chip>
          </div>
        </div>

        <ProblemCards />
      </div>
    </LandingSection>
  );
}
