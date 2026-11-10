CREATE TABLE `sleep` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	CONSTRAINT "sleep_end_after_start" CHECK("end" > "start"),
	CONSTRAINT "sleep_at_most_24_hours" CHECK("end" - "start" <= 86400000)
);
--> statement-breakpoint
CREATE INDEX `sleep_start` ON `sleep` (`start`);