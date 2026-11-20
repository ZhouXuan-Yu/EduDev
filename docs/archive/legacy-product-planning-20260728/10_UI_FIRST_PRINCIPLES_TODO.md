# Omni-Edu Agent UI Todo

## First Principles

1. A teacher needs to trust one local student archive before any advanced AI matters.
2. The MVP must reduce daily friction: create a student, add evidence, review the timeline, draft a review.
3. Large files belong to the file system; the UI should show paths, sizes, and recovery state instead of pretending everything is a small cloud object.
4. Every generated review must be editable and evidence-based. The teacher remains the final reviewer.
5. The product is a workbench, not a school platform, LMS, or marketing site.

## Page Todo

- [x] Convert the docx plan into the teacher workbench information architecture.
- [x] Build a first-screen app page instead of a landing page.
- [x] Use a HeroUI Pro style layout reference: app layout, sidebar, dense data cards, right context panel.
- [x] Show the P0 loop in one place: students, records, attachments, timeline, review draft.
- [x] Include teacher-editable states instead of one-click final AI output.
- [x] Include local-first storage signals: app data path, attachment metadata, offline status.
- [x] Add an adversarial review panel that checks MVP scope, privacy, editability, and demo readiness.
- [ ] Integrate the real Electron main/preload IPC boundary.
- [ ] Persist students, records, attachments, and reports in SQLite.
- [ ] Copy imported attachments into the per-student local folder.
- [ ] Add Playwright checks once the Electron shell or routed web app exists.

## Acceptance Checklist

- [ ] A teacher can identify where to create a student in under 5 seconds.
- [ ] A teacher can see the selected student's current issues, goals, and tags.
- [ ] A teacher can see recent learning records in time order.
- [ ] A teacher can see attachment status without loading large files into the database.
- [ ] A teacher can start a stage review from a selected student and date range.
- [ ] The page does not introduce accounts, cloud sync, parents, students, payments, or school admin features.
