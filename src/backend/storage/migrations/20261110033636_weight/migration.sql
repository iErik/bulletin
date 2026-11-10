CREATE TABLE `weight` (
	`date` text PRIMARY KEY,
	`grams` integer NOT NULL,
	CONSTRAINT "weight_date_not_null" CHECK("date" IS NOT NULL)
);
