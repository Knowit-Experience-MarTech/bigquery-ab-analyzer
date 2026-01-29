create or replace function `bigquery_ab_analyzer.udf_p_value_value`(
	n_a_value float64,
	mean_value_a float64,
	var_value_a float64,
	n_b_value float64,
	mean_value_b float64,
	var_value_b float64,
	test_type string
) as (
	(select case 
		when test_type = "Two-sided" then
			round(2 * (1 - bigquery_ab_analyzer.udf_normal_cdf(abs(bigquery_ab_analyzer.udf_t_statistic_value(n_a_value, mean_value_a, var_value_a, n_b_value, mean_value_b, var_value_b)), 0, 1)), 4)
		when test_type = "One-sided" then
			round(1 - bigquery_ab_analyzer.udf_normal_cdf(bigquery_ab_analyzer.udf_t_statistic_value(n_a_value, mean_value_a, var_value_a, n_b_value, mean_value_b, var_value_b), 0, 1), 4)
		else
			round(2 * (1 - bigquery_ab_analyzer.udf_normal_cdf(abs(bigquery_ab_analyzer.udf_t_statistic_value(n_a_value, mean_value_a, var_value_a, n_b_value, mean_value_b, var_value_b)), 0, 1)), 4)
		end
	)
);