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
