CREATE TABLE `mood` (
	`date` text PRIMARY KEY,
	`mood` text NOT NULL,
	CONSTRAINT "mood_date_not_null" CHECK("date" IS NOT NULL)
);
