/**
 * Copyright 2025 Knowit Experience Oslo
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "as IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 
 /** Query related information **
* Set data set location (EU or US).
* Replace "your_project" with your project.
 If you have changed suggested name for data set and table names in Google Sheet Settings, you must also replace these.
 */

declare bigquery_ab_analyzer_dataset_exists bool;

set bigquery_ab_analyzer_dataset_exists = (
  select count(1) > 0
  from `region-eu`.INFORMATION_SCHEMA.SCHEMATA /* For US, change the following: region-eu -> region-us */
  where schema_name = 'bigquery_ab_analyzer'
);

if not bigquery_ab_analyzer_dataset_exists then
  execute immediate 'create schema `bigquery_ab_analyzer` options (location="EU")'; /* For US, change the following: EU -> US */
end if;

/*** CREATE TABLES ***/
/*** Create experiments table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments` (
  id string options(description='Experiment ID.'),
  variant string options(description='Variant. A or B.'),
  date_start date options(description='Start date of the experiment.'),
  date_end date options(description='End date of the experiment.'),
  date_comparison bool options(description='TRUE if dates are split per variant (date comparison enabled).'),
  experiment_name string options(description='Name of the experiment.'),
  variant_name string options(description='Name of the variant.'),
  conversion_event string options(description='Name of the conversion event (ex. purchase)'),
  conversion_count_all bool options(description='If ticked, all conversions will be counted (total Event Count for the Conversion Event).'),
  exp_variant_string string options(description='Experiment variant string. Matching is based on REGEX_CONTAINS.'),
  analyze_test bool options(description='Experiment will be analyzed/queried if analyze_test is TRUE.'),
  event_value_test bool options(description='Should Event Value be analyzed/checked for significance. Can be any Event Scoped Metric.'),
  hypothesis string options(description='Do you wish to be confident whether the conversion rate of B is lower? If you choose One-sided then no conclusive statement can be made if the conversion rate of B is lower than of A.'),
  confidence int64 options(description='A Confidence Level shows how certain you can be that your results reflect reality. For example, a 95% confidence level means there\'s a 95% chance the true value lies within your calculated range.'),
  description string options(description='Description of the experiment.'),
  scope string options(description='Scope of the experiment. User or Session.'),
  identity_source string options(description='Identificator: Client ID, User ID, User ID or Client ID.'),
  experiment_event_name string options(description='Name of the experiment event. Ex. experience_impression.'),
  experiment_variant_parameter string options(description='Variant parameter for the experiment. Ex. exp_variant_string.'),
  experiment_event_value_parameter string options(description='Experiment value parameter. Ex. value. Can be any Event Scoped Metric.'),
  user_overlap string options(description='If you are exploring variants, and a user could have seen both variants, choose how to handle this scenario. "First Exposure" will credit the first variant the user saw. "Last Exposure" will credit the last variant the user saw. "Exclude" will exclude users from the analyzis. "Credit Both" will credit both variants.'),
  analytics_tool string options(description='Source of the experiment data, e.g. "Google Analytics 4" or "Amplitude".'),
  query_information_logging bool options(description='Should information about the query like bytes and job id be logged.'),
  query_price_per_tib float64 options(description='Query price per tebibyte (TiB) in USD. The first 1 TiB per month is free.')
)
cluster by id, experiment_name;		
		
/*** Create experiments_filters table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments_filters` (
  id string options(description='Experiment ID.'),
  variant string options(description='Variant. A or B.'),
  enabled bool options(description='TRUE: Filter is enabled for analyzis. FAlSE: Filter will not be used in analyzis.'),
  filter_type string options(description='Include or Exclude filter'),
  filter_on_value string options(description='Filter on Experiment Event, Conversion Event or Both.'),
  filter_scope string options(description='Filter on Event, User Property Scope (event_params or user_properties) OR BigQuery Column (Field Name), ex. "device. category".'),
  filter_field string options(description='parameter_name from BigQuery. Ex. ga_session_number'),
  filter_value string options(description='Parameter Value matching uses RegEx (REGEXP_CONTAINS)'),
  notes string options(description='Notes about the filter.'),
  source string options(description='Filter is sourced from simple or advanced filtering.')
)
cluster by id;
		
/*** Create experiments_links table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments_links` (
  id string options(description='Experiment ID.'),
  link string options(description='Link URL.')
)
cluster by id;

/*** Create experiments_images table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments_images` (
  id string options(description='Experiment ID.'),
  variant string options(description='Variant. A or B.'),
  image_url string options(description='Image URL.')
)
cluster by id;

/*** Create experiments_report table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments_report` (
  id string options(description='Experiment ID.'),
  date_start date options(description='Start date of the experiment.'),
  date_end date options(description='End date of the experiment.'),
  experiment_name string options(description='Name of the experiment.'),
  conversion_event string options(description='Name of the conversion event.'),
  scope string options(description='Scope of the experiment. User or Session.'),
  identity_source string options(description='Identificator: Client ID, User ID, User ID or Client ID.'),
  hypothesis string options(description='Do you wish to be confident whether the conversion rate of B is lower? If you choose 1-sided, then no conclusive statement can be made if the conversion rate of B is lower than of A.'),
  confidence_level float64 options(description='Probability of rejecting the Null Hypothesis when it is indeed false (1 - type I error).'),
  analyze_test bool options(description='Experiment will be analyzed/queried if analyze_test is true.'),
  user_overlap string options(description='If you are exploring variants, and a user could have seen both variants, choose how to handle this scenario. "First Exposure" will creadit the first variant the user saw. "Exclude" will exclude users from the analyzis/query.'),
  test_a int64 options(description='Count of participants (User or Session) in test/variant A.'),
  conversion_a int64 options(description='Count of conversions (User or Session) in test/variant A.'),
  test_b int64 options(description='Count of participants (User or Session) in test/variant B.'),
  conversion_b int64 options(description='Count of conversions (User or Session) in test/variant A.'),
  conv_rate_a float64 options(description='Conversion Rate for test/variant A.'),
  conv_rate_b float64 options(description='Conversion Rate for test/variant B.'),
  conv_z_score float64 options(description='A Z-score measures how far a value is from the average, in standard deviations. For example, a Z-score of +1.5 means the value is 1.5 standard deviations above average.'),
  conv_p_value float64 options(description='A P-value shows how likely your result occurred by chance. For example, a P-value of 0.03 means there\'s only a 3% chance the result happened randomly, suggesting it\'s likely meaningful.'),
  conv_significance string options(description='Is the conversion result significant. SIGNIFICANT/NOT_SIGNIFICANT.'),
  conv_details string options(description='Short description of the conversion result.'),
  conversions_counting_mode string options(description='Conversion counting method.'),
  mean_value_a float64 options(description='Mean Value for test/variant A if "value" is checked for significanse. A mean is a quantity representing the "center" of a collection of numbers and is intermediate to the extreme values of the set of numbers.'),
  mean_value_b float64 options(description='Mean Value for test/variant B if "value" is checked for significanse. A mean is a quantity representing the "center" of a collection of numbers and is intermediate to the extreme values of the set of numbers.'),
  t_value float64 options(description='Used if "value" is checked for significanse. A T-value measures the size of the difference between two groups relative to the variation in your data. For example, a large T-value (e.g., 3.2) suggests a meaningful difference, while a small T-value (e.g., 0.2) indicates little or no meaningful difference.'),
  value_p_value float64 options(description='Used if "value" is checked for significanse. A P-value shows how likely your result occurred by chance. For example, a P-value of 0.03 means there\'s only a 3% chance the result happened randomly, suggesting it\'s likely meaningful.'),
  value_significance string options(description='Is the "value" result significant. SIGNIFICANT/NOT_SIGNIFICANT.'),
  value_details string options(description='Short description of the "value" result.'),
  date_last_analyzed date options(description='Date when query for the experiment was last run.'),
  date_comparison bool options(description='TRUE if dates are split per variant (date comparison enabled).')
)
partition by date_last_analyzed
cluster by id, experiment_name;

/*** Create experiments_query_information table ***/
create table if not exists `your_project.bigquery_ab_analyzer.experiments_query_information` (
  id string options(description='Experiment ID.'),
  execution_time timestamp options(description='Timestamp.'),
  job_ids string options(description='Stores list of jobs (e.g. "job_1, job_2").'),
  total_bytes_billed int64 options(description='Estimation of total bytes billed.'),
  estimated_cost_usd numeric options(description='Estimation of cost in USD.')
);

/*** CREATE USER DEFINED FUNCTIONS (UDF) ***/
/*** function 01: z_score_proportion ***/
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

/*** function 02: normal_cdf ***/
create or replace function `bigquery_ab_analyzer.udf_normal_cdf`(
	x float64,
	mean float64,
	std float64
) 
returns float64 language js
	options (library=["gs://isb-cgc-bq-library/jstat/dist/jstat.min.js"]) as R"""
	return jStat.normal.cdf(x, mean, std);
	""";

/*** function 03: p_value_proportion ***/
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

/*** function 04: t_statistic_value ***/
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

/*** function 05: ab_result ***/
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




/*** function 06: p_value_value ***/
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

/*** function 07: rate_of_change ***/
create or replace function `bigquery_ab_analyzer.udf_rate_of_change`(
	before float64,
	after float64
) as (
	(after - before) / before * 100
);

/*** function 08: ab_count_welch ***/
create or replace function `your_project.bigquery_ab_analyzer.udf_ab_count_welch`(
	n_a int64,
	mean_a float64,
	var_a float64,
	n_b int64,
	mean_b float64,
  var_b float64,
  confidence_level float64,
  hypothesis string) 
  returns struct<metric_a float64, metric_b float64, stat float64, df float64, p_value float64, significance string, details string> as (
    (
      with inps as (
        select
          cast(greatest(n_a, 1) as float64) as n1,
          cast(greatest(n_b, 1) as float64) as n2,
          mean_a as m1,
          mean_b as m2,
          greatest(var_a, 0.0) as v1,
          greatest(var_b, 0.0) as v2,
          -- normalize confidence to (0,1)
          case
            when confidence_level is null then 0.95
            when confidence_level > 1 then least(confidence_level / 100.0, 0.999999999)
            else least(greatest(confidence_level, 1e-9), 0.999999999)
          end as cl,
          case
            when lower(trim(hypothesis)) in ('two-sided','two sided','two_sided') then 'two-sided'
            else 'one-sided'
          end as H
      ),
      core as (
        select
          n1,
          n2,
          m1,
          m2,
          v1,
          v2,
          cl,
          H,
          (v1/n1) + (v2/n2) as se2_raw,
          safe_divide(power((v1/n1)+(v2/n2), 2),
            nullif(
              safe_divide(power(v1/n1, 2), nullif(n1-1,0)) +
              safe_divide(power(v2/n2, 2), nullif(n2-1,0))
            ,0)
          ) as df
        from inps
      ),
      tcalc as (
        select
          n1,
          n2,
          m1,
          m2,
          v1,
          v2,
          cl,
          H,
          df,
          greatest(se2_raw, 0.0) as se2,
          case
            when se2_raw <= 0 then null
            else (m2 - m1) / SAFE.SQRT(greatest(se2_raw, 0.0))  -- <== was (m1 - m2)
          end as t
        from core
      ),
      -- Normal CDF approximation (Abramowitz–Stegun 26.2.17)
      norm as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          abs(t) as az,
          1.0 - cl as alpha
        from tcalc
      ),
      poly as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          alpha,
          1.0 / (1.0 + 0.2316419 * abs(t)) as tt,
          0.3989422804014327 * exp(-0.5 * abs(t) * abs(t)) as phi_abs
        from norm
      ),
      cdf as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          alpha,
          -- tail(|t|) ≈ φ(|t|) * P(tt)
          (phi_abs * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt)) as tail_abs,
          phi_abs
        from poly
      ),
      pvals as (
        select
          m1,
          m2,
          df,
          t,
          alpha,
          H,
          -- Φ(|t|) = 1 - tail(|t|)
          1.0 - tail_abs as Phi_abs,
          case
            when t is null then null
            when H = 'one-sided' then 1.0 - (case when t >= 0 then (1.0 - tail_abs) else tail_abs end)  -- 1 - Φ(t), alt.: B>A
            else 2.0 * (1.0 - (1.0 - tail_abs))  -- two-sided: 2*(1-Φ(|t|)) = 2*tail(|t|)
          end as p
        from cdf
      )
      select as struct
        m1 as metric_a,
        m2 as metric_b,
        t as stat,
        df as df,
        case when p is null then null else p end as p_value,
        case
          when t is null then 'NOT_EVALUATED'
          when p < alpha then 'SIGNIFICANT'
          else 'NOT_SIGNIFICANT'
        end as significance,
        case
          when t is null then 'Insufficient information.'
          when p < alpha then
            case
              when m2 > m1 then concat('Variant B is ',
                cast(round(safe_divide(m2 - m1, nullif(m1,0)) * 100, 1) as string),
                '% better than Variant A.')
              when m1 > m2 then concat('Variant A is ',
                cast(round(safe_divide(m1 - m2, nullif(m2,0)) * 100, 1) as string),
                '% better than Variant B.')
              else 'No difference.'
            end
          else 'No significant difference.'
        end as details
      from pvals
    )
);

/*** function 09: ab_rate_test ***/
create or replace function `your_project.bigquery_ab_analyzer.udf_ab_rate_test`(
	n_a int64,
	x_a int64,
	n_b int64,
	x_b int64,
	confidence_level float64,
	hypothesis string
	) returns struct<rate_a float64, rate_b float64, z_val float64, p_val float64, significance string, details string> as (
(
      with prep as (
        select
          cast(greatest(n_a, 1) as float64) as n1,
          cast(greatest(n_b, 1) as float64) as n2,
          greatest(x_a, 0) as xa,
          greatest(x_b, 0) as xb,
          case
            when confidence_level is null then 0.95
            when confidence_level > 1 then least(confidence_level / 100.0, 0.999999999)
            else least(greatest(confidence_level, 1e-9), 0.999999999)
          end as cl,
          case
            when lower(trim(hypothesis)) in ('two-sided','two sided','two_sided') then 'two-sided'
            else 'one-sided'
          end as H
      ),
      rates as (
        select
          n1,
          n2,
          xa,
          xb,
          cl,
          H,
          safe_divide(xa, n1) as ra,
          safe_divide(xb, n2) as rb,
          1.0 - cl as alpha
        from prep
      ),
      zcalc as (
        select
          n1,
          n2,
          xa,
          xb,
          ra,
          rb,
          alpha,
          H,
          case
            when xa > 0 and xb > 0 then
              -- METHOD 1: Z-Test for Poisson Rates (Log-Linear / Delta Method)
              -- Used when counts > 0. Tests the Ratio (Relative Lift).
              -- This approximates the variance of log(rate) as 1/count.
              -- H0: log(Rb/Ra) = 0
              safe_divide(
                LOG(safe_divide(rb, nullif(ra, 0))),
                SAFE.SQRT(safe_divide(1.0, xa) + safe_divide(1.0, xb))
              )
            else
              -- METHOD 2: Wald Test for Difference of Rates
              -- Fallback when counts are 0 (log is undefined).
              -- Tests the absolute Difference (Rb - Ra).
              -- H0: Rb - Ra = 0
              safe_divide(
                (rb - ra),
                SAFE.SQRT(greatest(safe_divide(ra, n1) + safe_divide(rb, n2), 0.0))
              )
          end as z
        from rates
      ),
      -- Normal CDF approximation (Abramowitz–Stegun 26.2.17)
      -- Calculates the area under the standard normal curve
      poly as (
        select
          ra,
          rb,
          z,
          alpha,
          H,
          abs(z) as az,
          1.0 / (1.0 + 0.2316419 * abs(z)) as tt,
          0.3989422804014327 * exp(-0.5 * z * z) as phi
        from zcalc
      ),
      tails as (
        select
          ra,
          rb,
          z,
          alpha,
          H,
          -- tail(|z|) ≈ φ(|z|) * P(tt)
          (phi * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt)) as tail_abs
        from poly
      )
      select as struct
        ra as rate_a,
        rb as rate_b,
        z as z_val,
        case
          when z is null then null
          when H = 'one-sided' then case when z >= 0 then tail_abs else 1.0 - tail_abs end
          else 2.0 * tail_abs
        end as p_val,
        case
          when z is null then 'NOT_EVALUATED'
          when (case when H = 'one-sided' then case when z >= 0 then tail_abs else 1.0 - tail_abs end else 2.0 * tail_abs end) < alpha
            then 'SIGNIFICANT'
          else 'NOT_SIGNIFICANT'
        end as significance,
        case
          when z is null then 'Insufficient information to evaluate.'
          when (case when H = 'one-sided' then case when z >= 0 then tail_abs else 1.0 - tail_abs end else 2.0 * tail_abs end) < alpha then
            case
              when rb > ra then concat('Variant B has ',
                cast(round(safe_divide(rb - ra, nullif(ra,0)) * 100, 1) as string),
                '% higher Event Rate per unit than A.')
              when ra > rb then concat('Variant A has ',
                cast(round(safe_divide(ra - rb, nullif(rb,0)) * 100, 1) as string),
                '% higher Event Rate per unit than B.')
              else 'No difference.'
            end
          else 'No significant difference.'
        end as details
      from tails
    )
);