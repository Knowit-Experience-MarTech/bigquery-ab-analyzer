create or replace function `bigquery_ab_analyzer.udf_rate_of_change`(
	before float64,
	after float64
) as (
	(after - before) / before * 100
);