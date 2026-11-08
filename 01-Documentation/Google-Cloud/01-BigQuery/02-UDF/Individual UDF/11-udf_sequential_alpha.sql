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
