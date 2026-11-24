INSERT INTO `habit_archive_periods` (`habit_id`, `start`, `end`)
SELECT
  `habits`.`id`,
  coalesce((
    SELECT date(max(`habit_entries`.`date`), '+1 day')
    FROM `habit_entries`
    WHERE `habit_entries`.`habit_id` = `habits`.`id`
  ), `habits`.`created`),
  NULL
FROM `habits`
WHERE `habits`.`archived` = 1;
