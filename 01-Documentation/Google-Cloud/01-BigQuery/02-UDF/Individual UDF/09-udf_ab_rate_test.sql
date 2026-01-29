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