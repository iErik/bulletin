CREATE TABLE `habit_entries` (
	`habit_id` integer NOT NULL,
	`date` text NOT NULL,
	CONSTRAINT `habit_entries_pk` PRIMARY KEY(`habit_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `habit_entries_date` ON `habit_entries` (`date`);