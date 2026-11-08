/* Standard SQL version (Abramowitz-Stegun 26.2.17, |error| < 7.5e-8). Replaces the
   JavaScript version that loaded jStat from a third-party Cloud Storage bucket. */
create or replace function `bigquery_ab_analyzer.udf_normal_cdf`(
	x float64,
	mean float64,
	std float64
)
returns float64 as (
	(
		select if(z >= 0, 1.0 - tail, tail)
		from (
			select
				z,
				0.3989422804014327 * exp(-0.5 * z * z)
					* (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt) as tail
			from (
				select z, 1.0 / (1.0 + 0.2316419 * abs(z)) as tt
				from (select safe_divide(x - mean, std) as z)
			)
		)
	)
);
