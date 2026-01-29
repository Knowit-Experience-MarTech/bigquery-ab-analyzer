create or replace function `bigquery_ab_analyzer.udf_ab_result`(
	test_a float64, 
	conversion_a float64, 
	test_b float64, 
	conversion_b float64, 
	confidence_level float64, 
	hypothesis string
) 
returns 
	struct<rate_a float64, 
	rate_b float64, 
	z_val float64, 
	p_val float64, 
	significance string, 
	details string> as (
	(
		with calc as (
			select
			safe_divide(conversion_a, nullif(test_a,0)) as rate_a,
			safe_divide(conversion_b, nullif(test_b,0)) as rate_b,
			bigquery_ab_analyzer.udf_z_score_proportion(test_a, conversion_a, test_b, conversion_b) as z_val,
			bigquery_ab_analyzer.udf_p_value_proportion(test_a, conversion_a, test_b, conversion_b, hypothesis) as p_val,
			(1 - confidence_level/100) as alpha
		)
		select struct(
			rate_a,
			rate_b,
			z_val,
			p_val,
			case 
				when p_val < alpha then 
				'SIGNIFICANT' else 
				'NOT_SIGNIFICANT' 
			end as significance,
			case
				when p_val < alpha and rate_a > rate_b then
				concat('Variant A is better than Variant B by ',
					cast(round(100 * safe_divide(rate_a - rate_b, nullif(rate_b,0)), 2) as string),
					'%.')
				when p_val < alpha and rate_b > rate_a then
					concat('Variant B is better than Variant A by ',
					cast(round(100 * safe_divide(rate_b - rate_a, nullif(rate_a,0)), 2) as string),
					'%.')
				else 'No significant difference.'
			end as details
		)
    from calc
	)
);