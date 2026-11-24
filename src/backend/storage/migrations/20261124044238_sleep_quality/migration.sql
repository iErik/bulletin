CREATE TABLE `sleep_quality` (
	`date` text PRIMARY KEY,
	`rating` integer NOT NULL,
	CONSTRAINT "sleep_quality_date_not_null" CHECK("date" IS NOT NULL),
	CONSTRAINT "sleep_quality_rating_range" CHECK("rating" BETWEEN 1 AND 5)
);
