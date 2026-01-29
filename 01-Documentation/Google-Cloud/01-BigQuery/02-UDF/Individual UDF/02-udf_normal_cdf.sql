create or replace function `bigquery_ab_analyzer.udf_normal_cdf`(
	x float64,
	mean float64,
	std float64
) 
returns float64 language js
	options (library=["gs://isb-cgc-bq-library/jstat/dist/jstat.min.js"]) as R"""
	return jStat.normal.cdf(x, mean, std);
	""";