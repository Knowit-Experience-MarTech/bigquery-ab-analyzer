create or replace function `bigquery_ab_analyzer.udf_t_statistic_value`(
	n_a_value float64,
	mean_value_a float64,
	var_value_a float64,
	n_b_value float64,
	mean_value_b float64,
	var_value_b float64
) as (
	case
		when n_a_value <= 0 or n_b_value <= 0 then null
		when coalesce(safe_divide(var_value_a, n_a_value), 0)
			+ coalesce(safe_divide(var_value_b, n_b_value), 0) = 0 then null
		else
			(mean_value_b - mean_value_a)
			/ sqrt(
			coalesce(safe_divide(var_value_a, n_a_value), 0)
			+ coalesce(safe_divide(var_value_b, n_b_value), 0)
	)
end
);