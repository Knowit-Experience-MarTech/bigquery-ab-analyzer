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
