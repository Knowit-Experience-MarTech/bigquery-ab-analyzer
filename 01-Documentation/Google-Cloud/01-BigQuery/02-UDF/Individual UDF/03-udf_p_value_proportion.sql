create or replace function `bigquery_ab_analyzer.udf_p_value_proportion`(
	test_a float64,
	conversion_a float64,
	test_b float64,
	conversion_b float64,
	hypothesis string
) as (
	case
		when hypothesis = 'Two-sided' then
			2 * (1 - bigquery_ab_analyzer.udf_normal_cdf(abs(bigquery_ab_analyzer.udf_z_score_proportion(test_a, conversion_a, test_b, conversion_b)), 0, 1))
		when hypothesis = 'One-sided' then
			(1 - bigquery_ab_analyzer.udf_normal_cdf(bigquery_ab_analyzer.udf_z_score_proportion(test_a, conversion_a, test_b, conversion_b), 0, 1))
		else
		2 * (1 - bigquery_ab_analyzer.udf_normal_cdf(abs(bigquery_ab_analyzer.udf_z_score_proportion(test_a, conversion_a, test_b, conversion_b)), 0, 1))
	end
);