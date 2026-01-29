create or replace function `bigquery_ab_analyzer.udf_z_score_proportion`(
	test_a float64,
	conversion_a float64,
	test_b float64,
	conversion_b float64
) as (
	case
		when test_a <= 0 or test_b <= 0 or (test_a + test_b) <= 0 then null
		when conversion_a + conversion_b = 0 then null  -- extra guard for 0 conversion rate
		when conversion_a + conversion_b = test_a + test_b then null  -- guard for 100% conversion
	else
		(safe_divide(conversion_b, nullif(test_b, 0))
		- safe_divide(conversion_a, nullif(test_a, 0)))
		/ sqrt(
			safe_divide(conversion_a + conversion_b, nullif(test_a + test_b, 0))
			* (1 - safe_divide(conversion_a + conversion_b, nullif(test_a + test_b, 0)))
			* (safe_divide(1, nullif(test_a, 0)) + safe_divide(1, nullif(test_b, 0)))
	)
end
);