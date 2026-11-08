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
