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
