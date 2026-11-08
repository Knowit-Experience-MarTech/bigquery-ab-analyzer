/**
 * Copyright 2026 Knowit AI & Analytics
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
/*** Create settings table ***/
create table if not exists `your_project.bigquery_ab_analyzer.settings` (
  query_information_logging bool options(description='Should information about the query like bytes and job id be logged.'),
  query_price_per_tib float64 options(description='Query price per tebibyte (TiB) in USD. The first 1 TiB per month is free.'),
  ai_summary_activated bool options(description='By ticking this box AI Summary will be activated. Requires extra setup in GCP.'),
  ai_prompt string options(description='Prompt that instructs AI how evaluate the result, and the tone used in the answer.')
);

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
  confidence int64 options(description='Confidence level in percent, e.g. 95. At 95%, the test is set up so that when there is no real difference, it wrongly reports a significant result at most 5% of the time.'),
  description string options(description='Description of the experiment.'),
  scope string options(description='Scope of the experiment. User or Session.'),
  identity_source string options(description='Identificator: Client ID, User ID, User ID or Client ID.'),
  experiment_event_name string options(description='Name of the experiment event. Ex. experience_impression.'),
  experiment_variant_parameter string options(description='Variant parameter for the experiment. Ex. exp_variant_string.'),
  experiment_event_value_parameter string options(description='Experiment value parameter. Ex. value. Can be any Event Scoped Metric.'),
  user_overlap string options(description='If you are exploring variants, and a user could have seen both variants, choose how to handle this scenario. "First Exposure" will credit the first variant the user saw. "Last Exposure" will credit the last variant the user saw. "Exclude" will exclude users from the analyzis. "Credit Both" will credit both variants.'),
  analytics_tool string options(description='Source of the experiment data, e.g. "Google Analytics 4" or "Amplitude".'),
  ai_total_target_sample int64 options(description='Total target sample size before AI will recommend the output. This is also known as "Fixed horizon".')
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
  filter_value string options(description='Parameter Value matching uses RegEx (REGEXP_CONTAINS)')
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
  conversion_b int64 options(description='Count of conversions (User or Session) in test/variant B.'),
  conv_rate_a float64 options(description='Conversion Rate for test/variant A.'),
  conv_rate_b float64 options(description='Conversion Rate for test/variant B.'),
  conv_z_score float64 options(description='A Z-score measures how far a value is from the average, in standard deviations. For example, a Z-score of +1.5 means the value is 1.5 standard deviations above average.'),
  conv_p_value float64 options(description='P-value for the conversion test. If there were no real difference between the variants, a result at least this extreme would occur this often. Example: 0.03 means 3% of the time.'),
  conv_significance string options(description='Is the conversion result significant. SIGNIFICANT/NOT_SIGNIFICANT.'),
  conv_details string options(description='Short description of the conversion result.'),
  conversions_counting_mode string options(description='Conversion counting method.'),
  mean_value_a float64 options(description='Mean Value for test/variant A if "value" is checked for significanse. A mean is a quantity representing the "center" of a collection of numbers and is intermediate to the extreme values of the set of numbers.'),
  mean_value_b float64 options(description='Mean Value for test/variant B if "value" is checked for significanse. A mean is a quantity representing the "center" of a collection of numbers and is intermediate to the extreme values of the set of numbers.'),
  t_value float64 options(description='Used if "value" is checked for significanse. A T-value measures the size of the difference between two groups relative to the variation in your data. For example, a large T-value (e.g., 3.2) suggests a meaningful difference, while a small T-value (e.g., 0.2) indicates little or no meaningful difference.'),
  value_p_value float64 options(description='Used if "value" is checked for significance. If there were no real difference between the variants, a result at least this extreme would occur this often. Example: 0.03 means 3% of the time.'),
  value_significance string options(description='Is the "value" result significant. SIGNIFICANT/NOT_SIGNIFICANT.'),
  value_details string options(description='Short description of the "value" result.'),
  date_last_analyzed date options(description='Date when query for the experiment was last run.'),
  date_comparison bool options(description='TRUE if dates are split per variant (date comparison enabled).'),
  ai_summary string options(description='Analysis summary made by Google Gemini AI.'),
  total_conversion_value_a float64 options(description='Total Conversion Value for Variant A.'),
  total_conversion_value_b float64 options(description='Total Conversion Value for Variant B.'),
  srm_p_value float64 options(description='Sample Ratio Mismatch p-value. Tests whether the A/B traffic split differs from the expected split.'),
  srm_status string options(description='Sample Ratio Mismatch status. OK, SRM_DETECTED (p < 0.001: the traffic split is broken, do not trust the results) or NOT_EVALUATED.'),
  target_sample int64 options(description='Target sample (A + B) used as the planned horizon. From ai_total_target_sample, or the default in the scheduled query.'),
  information_fraction float64 options(description='Share of the target sample collected so far (0 to 1).'),
  sequential_alpha float64 options(description='P-value threshold used today. With sequential monitoring it starts very strict and rises to its final value when the target sample is reached.'),
  conv_lift_ci_low float64 options(description='Lower bound of the confidence interval for the relative conversion lift of B vs A (0.05 = +5%). Uses the same threshold as the significance label.'),
  conv_lift_ci_high float64 options(description='Upper bound of the confidence interval for the relative conversion lift of B vs A (0.05 = +5%).'),
  value_lift_ci_low float64 options(description='Lower bound of the confidence interval for the relative value lift of B vs A (0.05 = +5%).'),
  value_lift_ci_high float64 options(description='Upper bound of the confidence interval for the relative value lift of B vs A (0.05 = +5%).'),
  method_warning string options(description='Warnings when the test assumptions do not hold: Credit Both, date comparison or Sample Ratio Mismatch. NULL when there is nothing to warn about.'),
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

create table if not exists `your_project.bigquery_ab_analyzer.experiments_funnel_report` (
  id string 
    options(description="The unique identifier for the experiment."),
  variant string 
    options(description="The experiment variant (e.g., 'A', 'B')."),
  step_number int64 
    options(description="The sequential number of the funnel step (1 = first step)."),
  step_name string 
    options(description="The GA4 event name representing this step in the funnel."),
  participants int64 
    options(description="The number of unique users or sessions (based on experiment scope) that successfully reached this step."),
  avg_time_from_previous_sec float64 
    options(description="The average time in seconds it took participants to reach this step from the immediately preceding step. Step 1 will always be 0."),
  median_time_from_previous_sec float64 
    options(description="The median time in seconds it took participants to reach this step from the immediately preceding step. Step 1 will always be 0."),
  drop_off_rate_from_previous float64 
    options(description="The percentage of participants from the previous step who did not make it to this step (e.g., 0.50 = 50% drop-off)."),
  total_conversion_rate float64 
    options(description="The percentage of participants from Step 1 who successfully reached this step (e.g., 0.10 = 10% conversion)."),
  date_last_analyzed date 
    options(description="The date this funnel data was last calculated.")
);

/*** ALTER TABLES ***/ 
alter table `your_project.bigquery_ab_analyzer.experiments`
add column if not exists ai_total_target_sample int64 
  options(description='Total target sample size before AI will recommend the output. This is also known as Fixed horizon.'),
add column if not exists analyze_funnel bool 
  options(description='Toggles the dynamic funnel analysis feature on or off for this experiment.'),
add column if not exists funnel_steps string 
  options(description='Comma-separated list of GA4 event names defining the funnel steps (e.g., "select_item, view_item, add_to_cart, purchase").'),
add column if not exists source_project_id string
  options(description='Google Cloud project with the analytics data (from the sheet settings).'),
add column if not exists source_dataset_id string
  options(description='Data set with the analytics data (from the sheet settings), e.g. analytics_123456 or superform_outputs_123456.'),
add column if not exists source_table_id string
  options(description='Analytics table (from the sheet settings): events_ (GA4, wildcard added by the query), ga4_events (GA4 Dataform), EVENTS_123 (Amplitude, deduplicated_ prefix added by the query), mp_master_event (Mixpanel) or events (PostHog).');

alter table `your_project.bigquery_ab_analyzer.settings`
add column if not exists region string
  options(description='BigQuery region of the data, e.g. region-eu or region-us. Used for query cost logging.');
  
alter table `your_project.bigquery_ab_analyzer.experiments_report`
add column if not exists ai_summary string 
  options(description="Analysis summary made by Google Gemini AI."),
add column if not exists total_conversion_value_a float64 
  options(description="Total Conversion Value for Variant A."),
add column if not exists total_conversion_value_b float64
  options(description="Total Conversion Value for Variant B."),
add column if not exists analyze_funnel bool
  options(description="Indicates if a dynamic funnel analysis was run for this experiment."),
add column if not exists srm_p_value float64
  options(description="Sample Ratio Mismatch p-value. Tests whether the A/B traffic split differs from the expected split."),
add column if not exists srm_status string
  options(description="Sample Ratio Mismatch status. OK, SRM_DETECTED (p < 0.001: the traffic split is broken, do not trust the results) or NOT_EVALUATED."),
add column if not exists target_sample int64
  options(description="Target sample (A + B) used as the planned horizon. From ai_total_target_sample, or the default in the scheduled query."),
add column if not exists information_fraction float64
  options(description="Share of the target sample collected so far (0 to 1)."),
add column if not exists sequential_alpha float64
  options(description="P-value threshold used today. With sequential monitoring it starts very strict and rises to its final value when the target sample is reached."),
add column if not exists conv_lift_ci_low float64
  options(description="Lower bound of the confidence interval for the relative conversion lift of B vs A (0.05 = +5%). Uses the same threshold as the significance label."),
add column if not exists conv_lift_ci_high float64
  options(description="Upper bound of the confidence interval for the relative conversion lift of B vs A (0.05 = +5%)."),
add column if not exists value_lift_ci_low float64
  options(description="Lower bound of the confidence interval for the relative value lift of B vs A (0.05 = +5%)."),
add column if not exists value_lift_ci_high float64
  options(description="Upper bound of the confidence interval for the relative value lift of B vs A (0.05 = +5%)."),
add column if not exists method_warning string
  options(description="Warnings when the test assumptions do not hold: Credit Both, date comparison or Sample Ratio Mismatch. NULL when there is nothing to warn about.");

alter table `your_project.bigquery_ab_analyzer.experiments`
alter column ai_total_target_sample set options(description='Total target sample size (A + B), also known as the fixed horizon. Used by sequential monitoring and by the AI summary. Plan it with the Pre-Test Calculator and add about 20% when sequential monitoring is on.');

/*** UPDATE COLUMN DESCRIPTIONS (corrected statistical wording) ***/
alter table `your_project.bigquery_ab_analyzer.experiments`
alter column experiment_event_value_parameter set options(description='Experiment value parameter, e.g. value or ecommerce.purchase_revenue. Can also be an item field (e.g. items.quantity, items.item_revenue or products.price), summed over the items that match the item filters on the conversion event. A price field is multiplied by quantity.'),
alter column confidence set options(description='Confidence level in percent, e.g. 95. At 95%, the test is set up so that when there is no real difference, it wrongly reports a significant result at most 5% of the time.');

alter table `your_project.bigquery_ab_analyzer.experiments_report`
alter column conversion_b set options(description='Count of conversions (User or Session) in test/variant B.'),
alter column conv_p_value set options(description='P-value for the conversion test. If there were no real difference between the variants, a result at least this extreme would occur this often. Example: 0.03 means 3% of the time.'),
alter column value_p_value set options(description='P-value for the value test. If there were no real difference between the variants, a result at least this extreme would occur this often. Example: 0.03 means 3% of the time.'),
alter column mean_value_a set options(description='Mean value for variant A. Per participant (non-converters count as 0) by default, or per converting participant, depending on the value_per_participant setting in the scheduled query.'),
alter column mean_value_b set options(description='Mean value for variant B. Per participant (non-converters count as 0) by default, or per converting participant, depending on the value_per_participant setting in the scheduled query.');
  
/*** DROP TABLES ***/
alter table `your_project.bigquery_ab_analyzer.experiments`
drop column if exists query_information_logging,
drop column if exists query_price_per_tib;

alter table `your_project.bigquery_ab_analyzer.experiments_filters`
drop column if exists notes,
drop column if exists source;
  
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
				when p_val is null then 'NOT_EVALUATED'
				when p_val < alpha then 'SIGNIFICANT'
				else 'NOT_SIGNIFICANT'
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
				when p_val is null then 'Insufficient information to evaluate (0% or 100% conversion, or no participants).'
				else 'No significant difference.'
			end as details
		)
    from calc
	)
);




/*** Removed functions ***/
/* udf_t_statistic_value, udf_p_value_value, udf_rate_of_change and udf_ab_rate_test are
   no longer used by the scheduled queries. They are no longer created. To remove them from an
   existing installation, after the new scheduled queries are deployed, run:
   drop function if exists `your_project.bigquery_ab_analyzer.udf_t_statistic_value`;
   drop function if exists `your_project.bigquery_ab_analyzer.udf_p_value_value`;
   drop function if exists `your_project.bigquery_ab_analyzer.udf_rate_of_change`;
   drop function if exists `your_project.bigquery_ab_analyzer.udf_ab_rate_test`;
*/

/*** function 12: student_t_upper_tail ***/
/* P(T > t) for Student's t distribution with df degrees of freedom (df can be fractional,
   as with Welch). Self-contained JavaScript, no external library: regularized incomplete beta
   function via continued fraction (Numerical Recipes). Must be created before function 08. */
create or replace function `your_project.bigquery_ab_analyzer.udf_student_t_upper_tail`(
  t float64,
  df float64
) returns float64 language js as r"""
  if (t === null || df === null || !(df > 0) || !isFinite(t)) return null;
  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    var MAXIT = 1000, EPS = 3e-14, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  var upper = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t));  // P(T > |t|)
  return t >= 0 ? upper : 1 - upper;
""";

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
          -- Student's t tail with Welch's degrees of freedom. Above 1000 df the t and normal
          -- distributions are practically identical, so the normal approximation is used.
          coalesce(
            if(df <= 1000, `your_project.bigquery_ab_analyzer.udf_student_t_upper_tail`(abs(t), df), null),
            (phi_abs * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt))
          ) as tail_abs,
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



/*** function 10: srm_test (Sample Ratio Mismatch) ***/
/* Chi-square goodness-of-fit test (1 degree of freedom) of the participant split
   against the expected share in variant B. Flags SRM_DETECTED at p < 0.001, the usual
   threshold, because an SRM check runs on every experiment, every day. */
create or replace function `your_project.bigquery_ab_analyzer.udf_srm_test`(
  n_a int64,
  n_b int64,
  expected_share_b float64,
  skip_test bool
) returns struct<chi_square float64, p_value float64, status string> as (
  (
    with prep as (
      select
        cast(n_a as float64) as a,
        cast(n_b as float64) as b,
        case
          when expected_share_b is null then 0.5
          when expected_share_b <= 0 or expected_share_b >= 1 then null
          else expected_share_b
        end as s
    ),
    calc as (
      select
        -- sum((O - E)^2 / E) over both cells simplifies to (b - N*s)^2 / (N * s * (1 - s))
        safe_divide(pow(b - (a + b) * s, 2), (a + b) * s * (1 - s)) as chi2
      from prep
      where a >= 0 and b >= 0
    ),
    poly as (
      select
        chi2,
        -- With 1 df, chi2 = z^2, so p = 2 * (1 - Phi(sqrt(chi2))).
        -- Normal tail via Abramowitz-Stegun 26.2.17, as in the other UDFs.
        1.0 / (1.0 + 0.2316419 * sqrt(chi2)) as tt,
        0.3989422804014327 * exp(-0.5 * chi2) as phi
      from calc
    ),
    pval as (
      select
        chi2,
        2.0 * phi * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt) as p
      from poly
    )
    select as struct
      chi2 as chi_square,
      p as p_value,
      case
        when coalesce(skip_test, false) then 'NOT_EVALUATED'
        when p is null then 'NOT_EVALUATED'
        when p < 0.001 then 'SRM_DETECTED'
        else 'OK'
      end as status
    from (select 1) left join pval on true
  )
);


/*** function 11: sequential_alpha (valid daily monitoring) ***/
/* Returns the p-value threshold to use today, given the share of the target sample
   collected (information_fraction, 0 to 1).
   Boundary: |z| >= c / sqrt(t), an O'Brien-Fleming type boundary for continuous monitoring.
   c is chosen so the overall false-positive rate stays at (1 - confidence) even if the
   results are checked continuously: c = z(1 - alpha/4) two-sided, z(1 - alpha/2) one-sided.
   With daily (discrete) checks the test is slightly conservative. At the target sample the
   two-sided 95% threshold is p < 0.025. Checking again after the target is reached keeps
   that final threshold, which adds a small amount of false-positive risk. */
create or replace function `your_project.bigquery_ab_analyzer.udf_sequential_alpha`(
  confidence_level float64,
  hypothesis string,
  information_fraction float64
) returns float64 as (
  (
    with prep as (
      select
        case
          when confidence_level is null then 0.95
          when confidence_level > 1 then least(confidence_level / 100.0, 0.999999999)
          else least(greatest(confidence_level, 1e-9), 0.999999999)
        end as cl,
        lower(trim(coalesce(hypothesis, ''))) not in ('one-sided', 'one sided', 'one_sided') as two_sided,
        least(greatest(coalesce(information_fraction, 1.0), 1e-6), 1.0) as t
    ),
    inv as (
      -- c = upper-tail normal quantile of tail_p (Abramowitz-Stegun 26.2.23, |error| < 4.5e-4)
      select
        two_sided,
        t,
        sqrt(-2.0 * ln(if(two_sided, (1 - cl) / 4, (1 - cl) / 2))) as w
      from prep
    ),
    boundary as (
      select
        two_sided,
        (w - (2.515517 + 0.802853 * w + 0.010328 * w * w)
             / (1 + 1.432788 * w + 0.189269 * w * w + 0.001308 * w * w * w)) / sqrt(t) as z
      from inv
    ),
    tail as (
      -- upper tail of the standard normal at z (Abramowitz-Stegun 26.2.17, as in the other UDFs)
      select
        two_sided,
        0.3989422804014327 * exp(-0.5 * z * z)
          * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt) as p
      from (select two_sided, z, 1.0 / (1.0 + 0.2316419 * z) as tt from boundary)
    )
    select if(two_sided, 2.0 * p, p) from tail
  )
);


/*** function 13: zero_inflated_variance ***/
/* Sample variance over n participants where k participants have a value (their sum = total and
   their sum of squared deviations from their own mean = m2) and the other n - k have 0.
   Uses the parallel-variance combination, which avoids the precision loss of
   sum(x^2) - sum(x)^2 / n with large values. */
create or replace function `your_project.bigquery_ab_analyzer.udf_zero_inflated_variance`(
  n int64,
  k int64,
  total float64,
  m2 float64
) returns float64 as (
  case
    when n is null or n < 2 then null
    when coalesce(k, 0) = 0 then 0.0
    else (coalesce(m2, 0.0) + pow(total / k, 2) * k * (n - k) / n) / (n - 1)
  end
);

/*** function 14: normal_upper_quantile ***/
/* z such that P(Z > z) = p for the standard normal distribution
   (Abramowitz-Stegun 26.2.23, |error| < 4.5e-4). */
create or replace function `your_project.bigquery_ab_analyzer.udf_normal_upper_quantile`(
  p float64
) returns float64 as (
  (
    select if(p > 0.5, -z, z)
    from (
      select w - (2.515517 + 0.802853 * w + 0.010328 * w * w)
               / (1 + 1.432788 * w + 0.189269 * w * w + 0.001308 * w * w * w) as z
      from (select sqrt(-2.0 * ln(if(p > 0.5, 1 - p, p))) as w)
    )
    where p > 0 and p < 1
  )
);

/*** function 15: lift_ci ***/
/* Confidence interval for the relative lift of B vs A (mean_b / mean_a - 1), using the delta
   method on the log ratio of the means. z is the critical value (for example 1.96).
   For conversion rates, pass var = rate * (1 - rate). Returns NULL when a mean is 0. */
create or replace function `your_project.bigquery_ab_analyzer.udf_lift_ci`(
  mean_a float64,
  var_a float64,
  n_a int64,
  mean_b float64,
  var_b float64,
  n_b int64,
  z float64
) returns struct<low float64, high float64> as (
  (
    select as struct
      exp(lr - z * se) - 1 as low,
      exp(lr + z * se) - 1 as high
    from (
      select
        ln(mean_b / mean_a) as lr,
        sqrt(greatest(var_a, 0.0) / (n_a * pow(mean_a, 2)) + greatest(var_b, 0.0) / (n_b * pow(mean_b, 2))) as se
      from (select 1)
      where mean_a > 0 and mean_b > 0 and n_a > 0 and n_b > 0
        and var_a is not null and var_b is not null and z is not null
    )
  )
);
