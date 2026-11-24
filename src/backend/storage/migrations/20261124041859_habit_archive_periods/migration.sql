CREATE TABLE `habit_archive_periods` (
	`habit_id` integer NOT NULL,
	`start` text NOT NULL,
	`end` text,
	CONSTRAINT `habit_archive_periods_pk` PRIMARY KEY(`habit_id`, `start`),
	CONSTRAINT "habit_archive_period_end" CHECK("end" IS NULL OR "end" >= "start")
);
